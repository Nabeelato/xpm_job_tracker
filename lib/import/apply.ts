import {
  AssignmentRole,
  AssignmentSource,
  ChangeSource,
  ImportRowAction,
  ImportStateComparisonCategory,
  ImportStatus,
  InternalStatus,
  type BookkeepingBy,
  type ClientCategory,
  type Department,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { detectClientCategoryFromManager, detectDepartment, detectDepartmentFromManager } from "@/lib/import/department";
import { normalizeClientName, normalizeHeader } from "@/lib/import/normalize";
import { nextJobLifecycleTimestamps, nextStateEnteredAt, parseJobStateNumber } from "@/lib/job-state";
import { departmentDefaultManagerNames } from "@/lib/constants";
import { getSystemSetting } from "@/lib/settings";

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

function mergeClientCategoryTarget(
  current: ClientCategory | undefined,
  next: ClientCategory | null,
): ClientCategory | undefined {
  if (!next) return current;
  if (next === "SOFTWARE") return "SOFTWARE";
  return current ?? "MANUAL";
}

function mergeClientBookkeepingByTarget(current: BookkeepingBy | undefined, next: BookkeepingBy | null): BookkeepingBy | undefined {
  if (!next) return current;
  return next;
}

export async function applyImportBatch(
  importBatchId: string,
  changedById: string,
  options: { allowOlderXpmDownloadedAt?: boolean } = {},
) {
  const classifyClientsFromSourceManager =
    (await getSystemSetting("classifyClientsFromSourceManager")) !== "false";
  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.findUnique({
        where: { id: importBatchId },
        include: { rows: { orderBy: { rowNumber: "asc" } } },
      });

      if (!batch) throw new Error("Import batch not found.");
      if (batch.status !== ImportStatus.STAGED) throw new Error("Only staged imports can be confirmed.");

      const lastApplied = await tx.importBatch.findFirst({
        where: { status: ImportStatus.APPLIED, id: { not: batch.id }, xpmDownloadedAt: { not: null } },
        orderBy: { xpmDownloadedAt: "desc" },
        select: { xpmDownloadedAt: true },
      });
      if (
        !options.allowOlderXpmDownloadedAt &&
        lastApplied?.xpmDownloadedAt &&
        batch.xpmDownloadedAt &&
        batch.xpmDownloadedAt <= lastApplied.xpmDownloadedAt
      ) {
        throw new Error("This XPM file is not newer than the previously applied import.");
      }

      const departments = departmentMap(await tx.department.findMany());
      const defaultManagerEntries = Object.entries(departmentDefaultManagerNames);
      const defaultManagerUsers = await tx.user.findMany({
        where: {
          active: true,
          role: { in: ["ADMIN", "MANAGER"] },
          name: { in: defaultManagerEntries.flatMap(([, names]) => names) },
        },
        select: { id: true, name: true },
      });
      const defaultManagerIdByDepartment = new Map(
        defaultManagerEntries.flatMap(([code, names]) => {
          const matched = defaultManagerUsers.find(
            (candidate) => names.some(
              (name) => candidate.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
            ),
          );
          return matched ? [[code, matched.id] as const] : [];
        }),
      );

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
      const clientCategoryTargets = new Map<string, ClientCategory>();
      const clientBookkeepingByTargets = new Map<string, BookkeepingBy>();

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
        const sourceManagerDepartmentCode = detectDepartmentFromManager(sourceManagerName);
        const sourceClientCategory = classifyClientsFromSourceManager
          ? detectClientCategoryFromManager(sourceManagerName)
          : null;
        const sourceClientBookkeepingBy = sourceClientCategory === "MANUAL" ? "FIRM" : null;
        // Source manager takes priority when it matches a department rule.
        const detectedCode =
          sourceManagerDepartmentCode ??
          row.detectedDepartmentCode ??
          detectDepartment(row.detectedJobName, row.detectedClientName);
        const autoDepartment = departments.get(detectedCode) ?? departments.get("UNCLASSIFIED");
        if (!autoDepartment) throw new Error("Default departments are missing. Run prisma:seed first.");
        const shouldForceDepartment = sourceManagerDepartmentCode !== null;

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
              jobStartedAt: jobStateNumber === 3 ? now : null,
              jobCompletedAt: jobStateNumber === 11 ? now : null,
              sourceManagerName,
              sourcePartnerName,
              autoDetectedDepartmentId: autoDepartment.id,
              finalDepartmentId: autoDepartment.id,
              departmentManuallyOverridden: false,
              internalStatus: InternalStatus.UNASSIGNED,
              missingFromLatestImport: false,
              createdFromImportBatchId: importBatchId,
              lastSeenImportBatchId: importBatchId,
              lastSeenAt: now,
            },
          });
          jobByExcelId.set(row.detectedJobId, { ...created, client });
          addLog(logs, created.id, importBatchId, changedById, "job_created", null, row.detectedJobId);
          const currentTarget = clientCategoryTargets.get(client.id);
          const mergedTarget = mergeClientCategoryTarget(currentTarget, sourceClientCategory);
          if (mergedTarget) clientCategoryTargets.set(client.id, mergedTarget);
          const currentBookkeepingTarget = clientBookkeepingByTargets.get(client.id);
          const mergedBookkeepingTarget = mergeClientBookkeepingByTarget(currentBookkeepingTarget, sourceClientBookkeepingBy);
          if (mergedBookkeepingTarget) clientBookkeepingByTargets.set(client.id, mergedBookkeepingTarget);
          continue;
        }

        const finalDepartmentId = shouldForceDepartment
          ? autoDepartment.id
          : existingJob.departmentManuallyOverridden
            ? existingJob.finalDepartmentId
            : autoDepartment.id;
        const nextDepartmentManuallyOverridden = shouldForceDepartment ? false : existingJob.departmentManuallyOverridden;
        const stateEnteredAt = nextStateEnteredAt({
          previousStateNumber: existingJob.jobStateNumber,
          nextStateNumber: jobStateNumber,
          previousStateEnteredAt: existingJob.stateEnteredAt,
          observedAt: now,
        });
        const lifecycleTimestamps = nextJobLifecycleTimestamps({
          nextStateNumber: jobStateNumber,
          jobStartedAt: existingJob.jobStartedAt,
          jobCompletedAt: existingJob.jobCompletedAt,
          observedAt: now,
        });

        addLog(logs, existingJob.id, importBatchId, changedById, "client_id", existingJob.clientId, client.id);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_name", existingJob.jobName, row.detectedJobName);
        addLog(logs, existingJob.id, importBatchId, changedById, "priority", existingJob.priority, priority);
        addLog(logs, existingJob.id, importBatchId, changedById, "xpm_state", existingJob.xpmState, xpmState);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_state_number", existingJob.jobStateNumber, jobStateNumber);
        addLog(logs, existingJob.id, importBatchId, changedById, "state_entered_at", existingJob.stateEnteredAt, stateEnteredAt);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_started_at", existingJob.jobStartedAt, lifecycleTimestamps.jobStartedAt);
        addLog(logs, existingJob.id, importBatchId, changedById, "job_completed_at", existingJob.jobCompletedAt, lifecycleTimestamps.jobCompletedAt);
        addLog(logs, existingJob.id, importBatchId, changedById, "source_manager_name", existingJob.sourceManagerName, sourceManagerName);
        addLog(logs, existingJob.id, importBatchId, changedById, "source_partner_name", existingJob.sourcePartnerName, sourcePartnerName);
        addLog(logs, existingJob.id, importBatchId, changedById, "auto_detected_department_id", existingJob.autoDetectedDepartmentId, autoDepartment.id);
        addLog(
          logs,
          existingJob.id,
          importBatchId,
          changedById,
          "department_manually_overridden",
          existingJob.departmentManuallyOverridden,
          nextDepartmentManuallyOverridden,
        );
        addLog(logs, existingJob.id, importBatchId, changedById, "final_department_id", existingJob.finalDepartmentId, finalDepartmentId);
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
            jobStartedAt: lifecycleTimestamps.jobStartedAt,
            jobCompletedAt: lifecycleTimestamps.jobCompletedAt,
            sourceManagerName,
            sourcePartnerName,
            autoDetectedDepartmentId: autoDepartment.id,
            finalDepartmentId,
            departmentManuallyOverridden: nextDepartmentManuallyOverridden,
            missingFromLatestImport: false,
            lastSeenImportBatchId: importBatchId,
            lastSeenAt: now,
          },
        });
        jobByExcelId.set(row.detectedJobId, { ...updated, client });
        const currentTarget = clientCategoryTargets.get(client.id);
        const mergedTarget = mergeClientCategoryTarget(currentTarget, sourceClientCategory);
        if (mergedTarget) clientCategoryTargets.set(client.id, mergedTarget);
        const currentBookkeepingTarget = clientBookkeepingByTargets.get(client.id);
        const mergedBookkeepingTarget = mergeClientBookkeepingByTarget(currentBookkeepingTarget, sourceClientBookkeepingBy);
        if (mergedBookkeepingTarget) clientBookkeepingByTargets.set(client.id, mergedBookkeepingTarget);
      }

      const importedJobs = await tx.job.findMany({
        where: { jobIdFromExcel: { in: importJobIds } },
        select: {
          id: true,
          finalDepartment: { select: { code: true } },
          assignments: {
            where: { active: true, assignmentRole: AssignmentRole.MANAGER },
            select: { id: true },
          },
        },
      });
      for (const job of importedJobs) {
        if (job.assignments.length) continue;
        const managerId = defaultManagerIdByDepartment.get(job.finalDepartment.code);
        if (!managerId) continue;
        await tx.jobAssignment.create({
          data: {
            jobId: job.id,
            userId: managerId,
            assignmentRole: AssignmentRole.MANAGER,
            assignmentSource: AssignmentSource.DEPARTMENT_AUTO,
            assignedById: changedById,
          },
        });
        await tx.job.updateMany({
          where: { id: job.id, internalStatus: InternalStatus.UNASSIGNED },
          data: { internalStatus: InternalStatus.ASSIGNED },
        });
        addLog(logs, job.id, importBatchId, changedById, "department_auto_assignment", null, managerId);
      }

      const clientsToUpdate = clientCategoryTargets.size
        ? await tx.client.findMany({
            where: { id: { in: [...clientCategoryTargets.keys()] } },
            select: { id: true, category: true, bookkeepingBy: true },
          })
        : [];

      for (const client of clientsToUpdate) {
        const targetCategory = clientCategoryTargets.get(client.id);
        const targetBookkeepingBy = clientBookkeepingByTargets.get(client.id);
        const updateData: { category?: ClientCategory; bookkeepingBy?: BookkeepingBy | null; bookkeepingSoftware?: null } = {};

        if (targetCategory && client.category !== targetCategory) {
          updateData.category = targetCategory;
        }

        if (targetCategory === "MANUAL") {
          updateData.bookkeepingBy = "FIRM";
          updateData.bookkeepingSoftware = null;
        } else if (targetBookkeepingBy && client.bookkeepingBy !== targetBookkeepingBy) {
          updateData.bookkeepingBy = targetBookkeepingBy;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.client.update({
            where: { id: client.id },
            data: updateData,
          });
        }
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
