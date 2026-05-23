import { ImportResultSections } from "@/components/import-result-sections";
import { ImportSummaryCards } from "@/components/import-summary-cards";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

export default async function ImportBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      xpmDownloadedAt: true,
      totalRows: true,
      newJobsCount: true,
      updatedJobsCount: true,
      unchangedJobsCount: true,
      newClientsCount: true,
      matchedClientsCount: true,
      missingJobsCount: true,
      vatJobsCount: true,
      softwareBkJobsCount: true,
      bkJobsCount: true,
      afsJobsCount: true,
      unclassifiedJobsCount: true,
      duplicateRowsCount: true,
      errorRowsCount: true,
      stateUpdatedCount: true,
      stateUnchangedCount: true,
      movedOutOfMainCount: true,
      completedStateCount: true,
      cancelledStateCount: true,
      rows: {
        select: {
          id: true,
          rowNumber: true,
          action: true,
          detectedJobId: true,
          detectedClientName: true,
          detectedJobName: true,
          detectedDepartmentCode: true,
          matchedClientId: true,
          previousXpmState: true,
          newXpmState: true,
          previousStateNumber: true,
          newStateNumber: true,
          stateComparisonCategory: true,
        },
        orderBy: { rowNumber: "asc" },
      },
    },
  });
  if (!batch) return null;

  return (
    <>
      <PageHeader
        description={`${batch.fileName} | ${batch.status} | Uploaded ${formatDateTime(batch.uploadedAt)} | XPM file date ${formatDateTime(batch.xpmDownloadedAt)}`}
        title="Import Batch Detail"
      />
      <ImportSummaryCards batch={batch} />
      <ImportResultSections rows={batch.rows} />
    </>
  );
}
