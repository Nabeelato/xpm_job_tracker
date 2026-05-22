import {
  ChangeSource,
  ImportRowAction,
  ImportStateComparisonCategory,
  ImportStatus,
  InternalStatus,
  type Department,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeClientName, normalizeHeader } from "@/lib/import/normalize";
import { detectClientCategoryFromManager, detectDepartment, detectDepartmentFromManager } from "@/lib/import/department";
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

export async function applyImportBatch(importBatchId: string, changedById: string) {
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
        lastApplied?.xpmDownloadedAt &&
        batch.xpmDownloadedAt &&
        batch.xpmDownloadedAt <= lastApplied.xpmDownloadedAt
      ) {
        throw new Error("This XPM file is not newer than the previously applied import.");
      }

      const departments = departmentMap(await tx.department.findMany());

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
      const softwareClientIds = new Set<string>();

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
        if (detectClientCategoryFromManager(sourceManagerName) === "SOFTWARE") {
          softwareClientIds.add(client.id);
        }
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
      }

      if (softwareClientIds.size > 0) {
        // Auto-categorize as Software Client when a job manager matches the SOFTWARE rule.
        // Only fills uncategorized rows — never overrides an admin's explicit MANUAL choice.
        await tx.client.updateMany({
          where: { id: { in: [...softwareClientIds] }, category: null },
          data: { category: "SOFTWARE" },
        });
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
