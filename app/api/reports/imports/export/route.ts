import { NextRequest, NextResponse } from "next/server";
import { ImportStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  addReportWorksheet,
  createReportWorkbook,
  invalidDateResponse,
  parseDateBoundary,
  reportLimitResponse,
  REPORT_EXPORT_LIMIT,
  workbookResponse,
} from "@/lib/reports";
import { getCurrentUser } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

function importStatusParam(value: string | null) {
  return value && Object.values(ImportStatus).includes(value as ImportStatus) ? (value as ImportStatus) : null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER" && user.departmentCode !== "QC") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const uploadedFrom = parseDateBoundary(params.get("uploadedFrom") ?? undefined);
  const uploadedTo = parseDateBoundary(params.get("uploadedTo") ?? undefined, true);
  const xpmFrom = parseDateBoundary(params.get("xpmFrom") ?? undefined);
  const xpmTo = parseDateBoundary(params.get("xpmTo") ?? undefined, true);

  if (uploadedFrom === "invalid") return invalidDateResponse("Uploaded from");
  if (uploadedTo === "invalid") return invalidDateResponse("Uploaded to");
  if (xpmFrom === "invalid") return invalidDateResponse("XPM from");
  if (xpmTo === "invalid") return invalidDateResponse("XPM to");

  const status = importStatusParam(params.get("status"));
  const uploadedById = params.get("uploadedById");

  const where: Prisma.ImportBatchWhereInput = {
    ...(status ? { status } : {}),
    ...(uploadedById ? { uploadedById } : {}),
    ...(uploadedFrom || uploadedTo
      ? {
          uploadedAt: {
            ...(uploadedFrom ? { gte: uploadedFrom } : {}),
            ...(uploadedTo ? { lte: uploadedTo } : {}),
          },
        }
      : {}),
    ...(xpmFrom || xpmTo
      ? {
          xpmDownloadedAt: {
            ...(xpmFrom ? { gte: xpmFrom } : {}),
            ...(xpmTo ? { lte: xpmTo } : {}),
          },
        }
      : {}),
  };

  const total = await prisma.importBatch.count({ where });
  if (total > REPORT_EXPORT_LIMIT) return reportLimitResponse(total);

  const batches = await prisma.importBatch.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    take: REPORT_EXPORT_LIMIT,
    select: {
      fileName: true,
      status: true,
      uploadedAt: true,
      xpmDownloadedAt: true,
      totalRows: true,
      newClientsCount: true,
      matchedClientsCount: true,
      newJobsCount: true,
      updatedJobsCount: true,
      unchangedJobsCount: true,
      missingJobsCount: true,
      duplicateRowsCount: true,
      errorRowsCount: true,
      stateUpdatedCount: true,
      stateUnchangedCount: true,
      movedOutOfMainCount: true,
      completedStateCount: true,
      cancelledStateCount: true,
      vatJobsCount: true,
      softwareBkJobsCount: true,
      bkJobsCount: true,
      afsJobsCount: true,
      unclassifiedJobsCount: true,
      uploadedBy: { select: { name: true } },
    },
  });

  const workbook = createReportWorkbook({
    title: "Import History Report",
    generatedBy: user.name,
    filters: [
      { label: "Uploaded From", value: params.get("uploadedFrom") },
      { label: "Uploaded To", value: params.get("uploadedTo") },
      { label: "XPM From", value: params.get("xpmFrom") },
      { label: "XPM To", value: params.get("xpmTo") },
      { label: "Status", value: params.get("status") },
      { label: "Uploaded By", value: params.get("uploadedById") },
      { label: "Rows", value: total },
    ],
  });

  addReportWorksheet(
    workbook,
    "Imports",
    [
      { header: "File", key: "file", width: 38 },
      { header: "Status", key: "status", width: 14 },
      { header: "Uploaded By", key: "uploadedBy", width: 24 },
      { header: "Uploaded At", key: "uploadedAt", width: 22 },
      { header: "XPM Exported At", key: "xpmDownloadedAt", width: 22 },
      { header: "Total Rows", key: "totalRows", width: 12 },
      { header: "New Clients", key: "newClients", width: 13 },
      { header: "Matched Clients", key: "matchedClients", width: 16 },
      { header: "New Jobs", key: "newJobs", width: 12 },
      { header: "Updated Jobs", key: "updatedJobs", width: 14 },
      { header: "Unchanged Jobs", key: "unchangedJobs", width: 16 },
      { header: "Missing Jobs", key: "missingJobs", width: 14 },
      { header: "Duplicate Rows", key: "duplicateRows", width: 15 },
      { header: "Error Rows", key: "errorRows", width: 12 },
      { header: "State Updated", key: "stateUpdated", width: 14 },
      { header: "State Unchanged", key: "stateUnchanged", width: 16 },
      { header: "Moved Out Of Main", key: "movedOutOfMain", width: 18 },
      { header: "Completed", key: "completed", width: 12 },
      { header: "Cancelled", key: "cancelled", width: 12 },
      { header: "VAT Jobs", key: "vatJobs", width: 12 },
      { header: "Software BK Jobs", key: "softwareBkJobs", width: 18 },
      { header: "BK Jobs", key: "bkJobs", width: 12 },
      { header: "AFS Jobs", key: "afsJobs", width: 12 },
      { header: "Unclassified Jobs", key: "unclassifiedJobs", width: 18 },
    ],
    batches.map((batch) => ({
      file: batch.fileName,
      status: batch.status,
      uploadedBy: batch.uploadedBy.name,
      uploadedAt: formatDateTime(batch.uploadedAt),
      xpmDownloadedAt: formatDateTime(batch.xpmDownloadedAt),
      totalRows: batch.totalRows,
      newClients: batch.newClientsCount,
      matchedClients: batch.matchedClientsCount,
      newJobs: batch.newJobsCount,
      updatedJobs: batch.updatedJobsCount,
      unchangedJobs: batch.unchangedJobsCount,
      missingJobs: batch.missingJobsCount,
      duplicateRows: batch.duplicateRowsCount,
      errorRows: batch.errorRowsCount,
      stateUpdated: batch.stateUpdatedCount,
      stateUnchanged: batch.stateUnchangedCount,
      movedOutOfMain: batch.movedOutOfMainCount,
      completed: batch.completedStateCount,
      cancelled: batch.cancelledStateCount,
      vatJobs: batch.vatJobsCount,
      softwareBkJobs: batch.softwareBkJobsCount,
      bkJobs: batch.bkJobsCount,
      afsJobs: batch.afsJobsCount,
      unclassifiedJobs: batch.unclassifiedJobsCount,
    })),
  );

  return workbookResponse(workbook, `import-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
