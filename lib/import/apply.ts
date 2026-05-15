import {
  AssignmentRole,
  AssignmentSource,
  ChangeSource,
  ImportRowAction,
  ImportStateComparisonCategory,
  ImportStatus,
  InternalStatus,
  type Department,
  type DepartmentDefaultAssignee,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeClientName, normalizeHeader } from "@/lib/import/normalize";
import { detectDepartment, detectDepartmentFromManager } from "@/lib/import/department";
import { parseJobStateNumber } from "@/lib/job-state";

const rawAliases = {
  priority: ["[Job] Priority", "priority"],
  xpmState: ["[State] State", "state", "job state", "xpm state"],
  manager: ["[Job] Manager", "manager", "job manager"],
  partner: ["[Job] Partner", "partner", "job partner"],
} as const;

function readRawValue(raw: Record<string, string>, aliases: readonly string[]) {
  const byHeader = new Map(Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of aliases) {
    const value = byHeader.get(normalizeHeader(alias));
    if (value) return value;
  }
  return null;
}

function valueForLog(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function addLog(
  logs: Prisma.JobChangeLogCreateManyInput[],
  jobId: string,
  importBatchId: string,
  changedById: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  if (valueForLog(oldValue) === valueForLog(newValue)) return;
  logs.push({
    jobId,
    importBatchId,
    changedById,
    changeSource: ChangeSource.IMPORT,
    fieldName,
    oldValue: valueForLog(oldValue),
    newValue: valueForLog(newValue),
  });
}

function departmentMap(departments: Department[]) {
  return new Map(departments.map((department) => [department.code, department]));
}

async function createNotification(
  tx: Prisma.TransactionClient,
  data: {
    recipientId: string;
    actorId?: string | null;
    type: "ASSIGNMENT_ADDED" | "ASSIGNMENT_REMOVED";
    title: string;
    body: string;
    href?: string | null;
    jobId?: string | null;
  },
) {
  if (data.actorId && data.actorId === data.recipientId) return;
  await tx.notification.create({ data });
}

type DeptDefault = DepartmentDefaultAssignee & { user: User };
type QcUser = Pick<User, "id" | "name">;

// Pre-fetched lookup maps passed in from the outer function — avoids repeated queries inside the per-job loop.
async function syncAutoAssignments(
  tx: Prisma.TransactionClient,
  jobId: string,
  jobIdFromExcel: string,
  finalDepartmentId: string,
  changedById: string,
  defaultsByDeptId: Map<string, DeptDefault[]>,
  qcUsers: QcUser[],
) {
  const departmentDefaults = defaultsByDeptId.get(finalDepartmentId) ?? [];
  const departmentUserIds = new Set(departmentDefaults.map((d) => d.userId));

  // One query per job to get all existing auto-assignments (replaces multiple findFirst calls)
  const existingAuto = await tx.jobAssignment.findMany({
    where: {
      jobId,
      active: true,
      assignmentSource: { in: [AssignmentSource.AUTO_DEPARTMENT, AssignmentSource.AUTO_QC] },
    },
  });

  const stale = existingAuto.filter(
    (a) => a.assignmentSource === AssignmentSource.AUTO_DEPARTMENT && !departmentUserIds.has(a.userId),
  );

  if (stale.length > 0) {
    await tx.jobAssignment.updateMany({
      where: { id: { in: stale.map((a) => a.id) } },
      data: { active: false },
    });
    for (const assignment of stale) {
      await createNotification(tx, {
        recipientId: assignment.userId,
        actorId: changedById,
        type: "ASSIGNMENT_REMOVED",
        title: "Assignment removed",
        body: `${jobIdFromExcel} is no longer auto-assigned to you for its department.`,
        href: `/jobs/${jobId}`,
        jobId,
      });
    }
  }

  const desired = [
    ...departmentDefaults.map((d) => ({
      userId: d.userId,
      role: AssignmentRole.PRIMARY,
      source: AssignmentSource.AUTO_DEPARTMENT,
      message: "A job was auto-assigned to you as department manager.",
    })),
    ...qcUsers.map((u) => ({
      userId: u.id,
      role: AssignmentRole.REVIEWER,
      source: AssignmentSource.AUTO_QC,
      message: "A job was auto-assigned to you for QC visibility.",
    })),
  ];

  // In-memory check against the pre-fetched existing set
  const existingKey = new Set(existingAuto.map((a) => `${a.userId}:${a.assignmentSource}`));

  for (const desired_ of desired) {
    if (existingKey.has(`${desired_.userId}:${desired_.source}`)) continue;

    await tx.jobAssignment.create({
      data: {
        jobId,
        userId: desired_.userId,
        assignmentRole: desired_.role,
        assignmentSource: desired_.source,
        assignedById: changedById,
      },
    });
    await createNotification(tx, {
      recipientId: desired_.userId,
      actorId: changedById,
      type: "ASSIGNMENT_ADDED",
      title: "Job assigned",
      body: `${jobIdFromExcel} ${desired_.message}`,
      href: `/jobs/${jobId}`,
      jobId,
    });
  }
}

export async function applyImportBatch(importBatchId: string, changedById: string) {
  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: importBatchId },
        include: { rows: { orderBy: { rowNumber: "asc" } } },
      });

      if (!batch) throw new Error("Import batch not found.");
      if (batch.status !== ImportStatus.STAGED) throw new Error("Only staged imports can be confirmed.");

      const departments = departmentMap(await tx.department.findMany());

      // Pre-fetch once — these are passed into every syncAutoAssignments call instead of re-fetching
      const [allDeptDefaults, qcUsers] = await Promise.all([
        tx.departmentDefaultAssignee.findMany({
          where: { active: true, user: { active: true } },
          include: { user: true },
        }),
        tx.user.findMany({
          where: { active: true, department: { code: "QC" } },
          select: { id: true, name: true },
        }),
      ]);

      const defaultsByDeptId = new Map<string, DeptDefault[]>();
      for (const d of allDeptDefaults) {
        const list = defaultsByDeptId.get(d.departmentId) ?? [];
        list.push(d);
        defaultsByDeptId.set(d.departmentId, list);
      }

      const importableRows = batch.rows.filter(
        (row) =>
          row.stateComparisonCategory !== ImportStateComparisonCategory.MISSING_FROM_UPLOAD &&
          (row.action === ImportRowAction.NEW_JOB ||
            row.action === ImportRowAction.UPDATE_JOB ||
            row.action === ImportRowAction.UNCHANGED),
      );
      const importJobIds = importableRows
        .map((row) => row.detectedJobId)
        .filter((jobId): jobId is string => Boolean(jobId));

      const existingJobs = await tx.job.findMany({
        where: { jobIdFromExcel: { in: importJobIds } },
        include: { client: true },
      });
      const jobByExcelId = new Map(existingJobs.map((job) => [job.jobIdFromExcel, job]));

      const logs: Prisma.JobChangeLogCreateManyInput[] = [];
      const now = new Date();

      for (const row of importableRows) {
        if (!row.detectedJobId || !row.detectedClientName || !row.detectedJobName) continue;

        const clientKey = normalizeClientName(row.detectedClientName);
        const client = await tx.client.upsert({
          where: { normalizedClientKey: clientKey },
          update: { sourceClientName: row.detectedClientName },
          create: {
            displayName: row.detectedClientName,
            sourceClientName: row.detectedClientName,
            normalizedClientKey: clientKey,
          },
        });

        const raw = row.rawDataJson as Record<string, string>;
        const priority = readRawValue(raw, rawAliases.priority);
        const xpmState = readRawValue(raw, rawAliases.xpmState);
        const jobStateNumber = row.newStateNumber ?? parseJobStateNumber(xpmState);
        const sourceManagerName = readRawValue(raw, rawAliases.manager);
        const sourcePartnerName = readRawValue(raw, rawAliases.partner);
        // Manager name takes priority: Haseeb→BK, Taaha→SOFTWARE_BK, Maaz→AFS, Faizan→VAT
        const detectedCode =
          detectDepartmentFromManager(sourceManagerName) ??
          row.detectedDepartmentCode ??
          detectDepartment(row.detectedJobName, row.detectedClientName);
        const autoDepartment = departments.get(detectedCode) ?? departments.get("UNCLASSIFIED");
        if (!autoDepartment) throw new Error("Default departments are missing. Run prisma:seed first.");

        const existingJob = jobByExcelId.get(row.detectedJobId);
        if (!existingJob) {
          const created = await tx.job.create({
            data: {
              jobIdFromExcel: row.detectedJobId,
              clientId: client.id,
              jobName: row.detectedJobName,
              priority,
              xpmState,
              jobStateNumber,
              stateEnteredAt: jobStateNumber ? now : null,
              sourceManagerName,
              sourcePartnerName,
              autoDetectedDepartmentId: autoDepartment.id,
              finalDepartmentId: autoDepartment.id,
              internalStatus: InternalStatus.UNASSIGNED,
              missingFromLatestImport: false,
              createdFromImportBatchId: importBatchId,
              lastSeenImportBatchId: importBatchId,
              lastSeenAt: now,
            },
          });
          jobByExcelId.set(row.detectedJobId, { ...created, client });
          addLog(logs, created.id, importBatchId, changedById, "job_created", null, row.detectedJobId);
          await syncAutoAssignments(tx, created.id, created.jobIdFromExcel, created.finalDepartmentId, changedById, defaultsByDeptId, qcUsers);
          continue;
        }

        const finalDepartmentId = existingJob.departmentManuallyOverridden
          ? existingJob.finalDepartmentId
          : autoDepartment.id;
        const stateChanged = existingJob.jobStateNumber !== jobStateNumber;
        const stateEnteredAt = stateChanged ? (jobStateNumber ? now : null) : existingJob.stateEnteredAt;

        addLog(logs, existingJob.id, importBatchId, changedById, "client_id", existingJob.clientId, client.id);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_name", existingJob.jobName, row.detectedJobName);
        addLog(logs, existingJob.id, importBatchId, changedById, "priority", existingJob.priority, priority);
        addLog(logs, existingJob.id, importBatchId, changedById, "xpm_state", existingJob.xpmState, xpmState);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_state_number", existingJob.jobStateNumber, jobStateNumber);
        addLog(logs, existingJob.id, importBatchId, changedById, "state_entered_at", existingJob.stateEnteredAt, stateEnteredAt);
        addLog(logs, existingJob.id, importBatchId, changedById, "source_manager_name", existingJob.sourceManagerName, sourceManagerName);
        addLog(logs, existingJob.id, importBatchId, changedById, "source_partner_name", existingJob.sourcePartnerName, sourcePartnerName);
        addLog(logs, existingJob.id, importBatchId, changedById, "auto_detected_department_id", existingJob.autoDetectedDepartmentId, autoDepartment.id);
        if (!existingJob.departmentManuallyOverridden) {
          addLog(logs, existingJob.id, importBatchId, changedById, "final_department_id", existingJob.finalDepartmentId, finalDepartmentId);
        }
        addLog(logs, existingJob.id, importBatchId, changedById, "missing_from_latest_import", existingJob.missingFromLatestImport, false);

        const updated = await tx.job.update({
          where: { id: existingJob.id },
          data: {
            clientId: client.id,
            jobName: row.detectedJobName,
            priority,
            xpmState,
            jobStateNumber,
            stateEnteredAt,
            sourceManagerName,
            sourcePartnerName,
            autoDetectedDepartmentId: autoDepartment.id,
            finalDepartmentId,
            missingFromLatestImport: false,
            lastSeenImportBatchId: importBatchId,
            lastSeenAt: now,
          },
        });
        jobByExcelId.set(row.detectedJobId, { ...updated, client });
        await syncAutoAssignments(tx, updated.id, updated.jobIdFromExcel, updated.finalDepartmentId, changedById, defaultsByDeptId, qcUsers);
      }

      const missingJobs = await tx.job.findMany({
        where: {
          archived: false,
          jobIdFromExcel: { notIn: importJobIds.length ? importJobIds : ["__none__"] },
          missingFromLatestImport: false,
        },
        include: { client: true },
      });

      if (missingJobs.length > 0) {
        await tx.job.updateMany({
          where: { id: { in: missingJobs.map((job) => job.id) } },
          data: { missingFromLatestImport: true },
        });
        for (const job of missingJobs) {
          addLog(logs, job.id, importBatchId, changedById, "missing_from_latest_import", false, true);
        }
        const stagedMissingRows = batch.rows.some(
          (row) => row.stateComparisonCategory === ImportStateComparisonCategory.MISSING_FROM_UPLOAD,
        );
        if (!stagedMissingRows) {
          await tx.importRow.createMany({
            data: missingJobs.map((job) => ({
              importBatchId,
              rowNumber: 0,
              rawDataJson: {},
              detectedJobId: job.jobIdFromExcel,
              detectedClientName: job.client.displayName,
              detectedJobName: job.jobName,
              detectedDepartmentCode: null,
              previousXpmState: job.xpmState,
              newXpmState: null,
              previousStateNumber: job.jobStateNumber,
              newStateNumber: null,
              stateComparisonCategory: ImportStateComparisonCategory.MISSING_FROM_UPLOAD,
              action: ImportRowAction.UNCHANGED,
              matchedClientId: job.clientId,
              matchedJobId: job.id,
            })),
          });
        }
      }

      if (logs.length > 0) {
        await tx.jobChangeLog.createMany({ data: logs });
      }

      return tx.importBatch.update({
        where: { id: importBatchId },
        data: { status: ImportStatus.APPLIED },
      });
    },
    { timeout: 300000 }, // 5-minute timeout for large imports
  );
}
