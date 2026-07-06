import { CheckCircle2 } from "lucide-react";
import { ImportStatus } from "@prisma/client";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ImportResultSections } from "@/components/import-result-sections";
import { ImportSummaryCards } from "@/components/import-summary-cards";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { confirmImportAction } from "../../actions";

const previewErrors: Record<string, string> = {
  "download-date-not-newer": "This XPM file date is not newer than the latest applied import. Check the admin override box to confirm it anyway.",
};

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; overrideXpmDate?: string }>;
}) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const [batch, lastApplied] = await Promise.all([
    prisma.importBatch.findUnique({
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
          matchedJob: {
            select: {
              jobName: true,
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: { rowNumber: "asc" },
      },
    },
    }),
    prisma.importBatch.findFirst({
      where: { status: ImportStatus.APPLIED, id: { not: id }, xpmDownloadedAt: { not: null } },
      orderBy: { xpmDownloadedAt: "desc" },
      select: { fileName: true, xpmDownloadedAt: true },
    }),
  ]);

  if (!batch) return null;
  const canConfirm = user.role === "ADMIN";
  const requiresXpmOverride = Boolean(
    lastApplied?.xpmDownloadedAt &&
      batch.xpmDownloadedAt &&
      batch.xpmDownloadedAt <= lastApplied.xpmDownloadedAt,
  );
  const defaultOverride = query.overrideXpmDate === "true";
  const errorMessage = query.error ? previewErrors[query.error] : "";

  return (
    <>
      <PageHeader
        description={`${batch.fileName} | Uploaded by ${batch.uploadedBy.name} | Uploaded ${formatDateTime(batch.uploadedAt)} | XPM file date ${formatDateTime(batch.xpmDownloadedAt)}`}
        title="Import Preview"
      />
      <ImportSummaryCards batch={batch} />
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Confirm Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirmation creates or updates jobs from the uploaded file, reclassifies their department from the source manager, updates client categories from the source manager, and marks previously imported missing jobs without deleting them.
          </p>
          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          {requiresXpmOverride ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-medium">Older or same XPM file date detected</div>
              <div className="mt-1 text-xs text-amber-900">
                Latest applied file: {lastApplied?.fileName ?? "Unknown"} ({formatDateTime(lastApplied?.xpmDownloadedAt)}).
                Confirm only if you are recovering from a failed import.
              </div>
            </div>
          ) : null}
          {canConfirm ? (
            <form action={confirmImportAction}>
              <input name="batchId" type="hidden" value={batch.id} />
              {requiresXpmOverride ? (
                <label className="mb-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <input
                    className="mt-1"
                    defaultChecked={defaultOverride}
                    name="overrideXpmDate"
                    type="checkbox"
                    value="true"
                  />
                  <span>
                    <span className="block font-medium">Admin override: confirm older or same XPM file date</span>
                    <span className="mt-1 block text-xs text-amber-900">
                      This bypasses only the newer-file rule for this confirmation.
                    </span>
                  </span>
                </label>
              ) : null}
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
      <ImportResultSections
        rows={batch.rows.map((row) => ({
          id: row.id,
          rowNumber: row.rowNumber,
          action: row.action,
          detectedJobId: row.detectedJobId,
          detectedClientName: row.detectedClientName,
          detectedJobName: row.detectedJobName,
          previousXpmState: row.previousXpmState,
          newXpmState: row.newXpmState,
          previousStateNumber: row.previousStateNumber,
          newStateNumber: row.newStateNumber,
          stateComparisonCategory: row.stateComparisonCategory,
          matchedJobName: row.matchedJob?.jobName ?? null,
          matchedClientName: row.matchedJob?.client.displayName ?? null,
        }))}
      />
    </>
  );
}
