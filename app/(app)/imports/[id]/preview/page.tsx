import { CheckCircle2 } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ImportResultSections } from "@/components/import-result-sections";
import { ImportSummaryCards } from "@/components/import-summary-cards";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/utils";
import { confirmImportAction } from "../../actions";

export default async function ImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
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
      uploadedBy: { select: { name: true } },
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
          errorMessage: true,
        },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!batch) return null;
  const canConfirm = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        description={`${batch.fileName} | Uploaded by ${batch.uploadedBy.name} | Uploaded ${formatDateTime(batch.uploadedAt)} | XPM file date ${formatDate(batch.xpmDownloadedAt)}`}
        title="Import Preview"
      />
      <ImportSummaryCards batch={batch} />
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Confirm Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirmation creates or updates jobs, preserves assignments/status/comments/manual department corrections, and marks previously imported missing jobs without deleting them.
          </p>
          {canConfirm ? (
            <form action={confirmImportAction}>
              <input name="batchId" type="hidden" value={batch.id} />
              <FormSubmitButton disabled={batch.status !== "STAGED"} pendingLabel="Applying import...">
                <CheckCircle2 className="h-4 w-4" />
                Confirm import
              </FormSubmitButton>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Only administrators can confirm imports.</p>
          )}
        </CardContent>
      </Card>
      <ImportResultSections rows={batch.rows} />
    </>
  );
}
