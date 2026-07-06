import { ImportRowAction, ImportStateComparisonCategory, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { detectDepartmentFromManager } from "@/lib/import/department";
import { normalizeClientName } from "@/lib/import/normalize";
import { parseImportFile } from "@/lib/import/parser";
import { isMainState } from "@/lib/job-state";

const departmentWorkflowStateNumbers = new Set([3, 4, 5, 6]);

function sameNullable(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? null) === (b ?? null);
}

function comparisonCategory(previousNumber: number | null | undefined, newNumber: number | null | undefined, matched: boolean) {
  if (newNumber === 11) return ImportStateComparisonCategory.COMPLETED;
  if (newNumber === 12) return ImportStateComparisonCategory.CANCELLED;
  if (!matched) {
    return isMainState(newNumber) ? ImportStateComparisonCategory.NEW_MAIN : ImportStateComparisonCategory.NOT_APPLICABLE;
  }
  if (previousNumber === newNumber) {
    return isMainState(newNumber) ? ImportStateComparisonCategory.STATE_UNCHANGED : ImportStateComparisonCategory.NOT_APPLICABLE;
  }
  if (isMainState(previousNumber) && !isMainState(newNumber)) return ImportStateComparisonCategory.MOVED_OUT_OF_MAIN;
  if (isMainState(previousNumber) || isMainState(newNumber)) return ImportStateComparisonCategory.STATE_UPDATED;
  return ImportStateComparisonCategory.NOT_APPLICABLE;
}

export async function stageImportBatch(file: File, uploadedById: string, xpmDownloadedAt: Date) {
  const parsed = await parseImportFile(file);
  const seenJobIds = new Set<string>();
  const validJobIds = new Set<string>();
  const validClientKeys = new Set<string>();
  const departmentCounts = {
    VAT: 0,
    SOFTWARE_BK: 0,
    BK: 0,
    AFS: 0,
    QC: 0,
    UNCLASSIFIED: 0,
  };

  const normalizedClientKeys = Array.from(
    new Set(parsed.rows.map((row) => normalizeClientName(row.clientName)).filter(Boolean)),
  );
  const uploadedJobIds = Array.from(new Set(parsed.rows.map((row) => row.jobId).filter(Boolean)));

  const [existingClients, existingJobs, departments] = await Promise.all([
    prisma.client.findMany({
      where: { normalizedClientKey: { in: normalizedClientKeys } },
    }),
    prisma.job.findMany({
      where: { jobIdFromExcel: { in: uploadedJobIds } },
      include: {
        client: true,
        autoDetectedDepartment: true,
        finalDepartment: true,
      },
    }),
    prisma.department.findMany(),
  ]);

  const clientByKey = new Map(existingClients.map((client) => [client.normalizedClientKey, client]));
  const jobByExcelId = new Map(existingJobs.map((job) => [job.jobIdFromExcel, job]));
  const departmentByCode = new Map(departments.map((department) => [department.code, department]));

  let duplicateRowsCount = 0;
  let errorRowsCount = 0;
  let newJobsCount = 0;
  let updatedJobsCount = 0;
  let unchangedJobsCount = 0;
  let stateUpdatedCount = 0;
  let stateUnchangedCount = 0;
  let movedOutOfMainCount = 0;
  let completedStateCount = 0;
  let cancelledStateCount = 0;

  const importRows: Prisma.ImportRowCreateManyInput[] = parsed.rows.map((row) => {
    const clientKey = normalizeClientName(row.clientName);
    const matchedClient = clientByKey.get(clientKey);
    const matchedJob = jobByExcelId.get(row.jobId);
    let action: ImportRowAction = ImportRowAction.UNCHANGED;
    let errorMessage = row.errorMessage;
    let stateComparisonCategory: ImportStateComparisonCategory = ImportStateComparisonCategory.NOT_APPLICABLE;

    if (row.jobId && seenJobIds.has(row.jobId)) {
      action = ImportRowAction.DUPLICATE_IN_FILE;
      errorMessage = "Duplicate Job No. in uploaded file.";
      duplicateRowsCount += 1;
    } else if (errorMessage) {
      action = ImportRowAction.ERROR;
      errorRowsCount += 1;
    } else {
      seenJobIds.add(row.jobId);
      validJobIds.add(row.jobId);
      validClientKeys.add(clientKey);
      if (row.jobStateNumber !== null && departmentWorkflowStateNumbers.has(row.jobStateNumber)) {
        departmentCounts[row.detectedDepartmentCode] += 1;
      }
      stateComparisonCategory = comparisonCategory(matchedJob?.jobStateNumber, row.jobStateNumber, Boolean(matchedJob));
      if (stateComparisonCategory === ImportStateComparisonCategory.STATE_UPDATED) stateUpdatedCount += 1;
      if (stateComparisonCategory === ImportStateComparisonCategory.STATE_UNCHANGED) stateUnchangedCount += 1;
      if (stateComparisonCategory === ImportStateComparisonCategory.MOVED_OUT_OF_MAIN) movedOutOfMainCount += 1;
      if (stateComparisonCategory === ImportStateComparisonCategory.COMPLETED) completedStateCount += 1;
      if (stateComparisonCategory === ImportStateComparisonCategory.CANCELLED) cancelledStateCount += 1;

      if (!matchedJob) {
        action = ImportRowAction.NEW_JOB;
        newJobsCount += 1;
      } else {
        const sourceManagerDepartmentCode = detectDepartmentFromManager(row.managerName);
        const shouldForceDepartment = sourceManagerDepartmentCode !== null;
        const effectiveDepartmentCode = sourceManagerDepartmentCode ?? row.detectedDepartmentCode;
        const autoDepartment = departmentByCode.get(effectiveDepartmentCode);
        const nextFinalDepartmentId = shouldForceDepartment
          ? autoDepartment?.id
          : matchedJob.departmentManuallyOverridden
            ? matchedJob.finalDepartmentId
            : autoDepartment?.id;
        const manualOverrideCleared = shouldForceDepartment && matchedJob.departmentManuallyOverridden;
        const sourceChanged =
          matchedJob.client.normalizedClientKey !== clientKey ||
          matchedJob.jobName !== row.jobName ||
          !sameNullable(matchedJob.priority, row.priority) ||
          !sameNullable(matchedJob.xpmState, row.xpmState) ||
          matchedJob.jobStateNumber !== row.jobStateNumber ||
          !sameNullable(matchedJob.sourceManagerName, row.managerName) ||
          !sameNullable(matchedJob.sourcePartnerName, row.partnerName) ||
          !sameNullable(matchedJob.autoDetectedDepartmentId, autoDepartment?.id ?? null) ||
          matchedJob.finalDepartmentId !== nextFinalDepartmentId ||
          manualOverrideCleared ||
          matchedJob.missingFromLatestImport;

        if (sourceChanged) {
          action = ImportRowAction.UPDATE_JOB;
          updatedJobsCount += 1;
        } else {
          action = ImportRowAction.UNCHANGED;
          unchangedJobsCount += 1;
        }
      }
    }

    return {
      importBatchId: "",
      rowNumber: row.rowNumber,
      rawDataJson: row.rawData,
      detectedJobId: row.jobId || null,
      detectedClientName: row.clientName || null,
      detectedJobName: row.jobName || null,
      detectedDepartmentCode: row.detectedDepartmentCode,
      previousXpmState: matchedJob?.xpmState ?? null,
      newXpmState: row.xpmState,
      previousStateNumber: matchedJob?.jobStateNumber ?? null,
      newStateNumber: row.jobStateNumber,
      stateComparisonCategory,
      action,
      errorMessage,
      matchedClientId: matchedClient?.id ?? null,
      matchedJobId: matchedJob?.id ?? null,
    };
  });

  const newClientKeys = new Set([...validClientKeys].filter((key) => !clientByKey.has(key)));
  const matchedClientKeys = new Set([...validClientKeys].filter((key) => clientByKey.has(key)));
  const validJobIdList = [...validJobIds];
  const missingJobs = await prisma.job.findMany({
    where: {
      archived: false,
      jobIdFromExcel: { notIn: validJobIdList.length ? validJobIdList : ["__none__"] },
    },
    include: { client: true },
    orderBy: [{ client: { displayName: "asc" } }, { jobIdFromExcel: "asc" }],
  });
  const missingJobsCount = missingJobs.length;
  const missingImportRows: Prisma.ImportRowCreateManyInput[] = missingJobs.map((job) => ({
    importBatchId: "",
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
    errorMessage: null,
    matchedClientId: job.clientId,
    matchedJobId: job.id,
  }));

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          fileName: parsed.fileName,
          fileHash: parsed.fileHash,
          uploadedById,
          xpmDownloadedAt,
          totalRows: parsed.rows.length,
          newClientsCount: newClientKeys.size,
          matchedClientsCount: matchedClientKeys.size,
          newJobsCount,
          updatedJobsCount,
          unchangedJobsCount,
          missingJobsCount,
          vatJobsCount: departmentCounts.VAT,
          softwareBkJobsCount: departmentCounts.SOFTWARE_BK,
          bkJobsCount: departmentCounts.BK,
          afsJobsCount: departmentCounts.AFS,
          unclassifiedJobsCount: departmentCounts.UNCLASSIFIED,
          duplicateRowsCount,
          errorRowsCount,
          stateUpdatedCount,
          stateUnchangedCount,
          movedOutOfMainCount,
          completedStateCount,
          cancelledStateCount,
        },
      });

      const rowsToCreate = [...importRows, ...missingImportRows];
      if (rowsToCreate.length > 0) {
        await tx.importRow.createMany({
          data: rowsToCreate.map((row) => ({ ...row, importBatchId: batch.id })),
        });
      }

      return batch;
    },
    {
      timeout: 300000, // 5-minute timeout for large staged imports
      maxWait: 300000,
    },
  );
}
