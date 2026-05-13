import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ImportBatchBreakdown } from "@/components/import-batch-breakdown";
import { ImportSummaryCards } from "@/components/import-summary-cards";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { confirmImportAction } from "../../actions";

export default async function ImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
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
          newXpmState: true,
          newStateNumber: true,
          errorMessage: true,
        },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!batch) return null;
  const issueRows = batch.rows.filter((row) => row.action === "ERROR" || row.action === "DUPLICATE_IN_FILE").slice(0, 20);

  return (
    <>
      <PageHeader description={`${batch.fileName} | Uploaded by ${batch.uploadedBy.name} | ${formatDateTime(batch.uploadedAt)}`} title="Import Preview" />
      <ImportSummaryCards batch={batch} />
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Confirm Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirmation creates or updates jobs, preserves assignments/status/comments/manual department corrections, and marks previously imported missing jobs without deleting them.
          </p>
          <form action={confirmImportAction}>
            <input name="batchId" type="hidden" value={batch.id} />
            <Button disabled={batch.status !== "STAGED"} type="submit">
              <CheckCircle2 className="h-4 w-4" />
              Confirm import
            </Button>
          </form>
        </CardContent>
      </Card>
      <ImportBatchBreakdown rows={batch.rows} />

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Duplicate and Error Rows</CardTitle>
        </CardHeader>
        <CardContent>
          {issueRows.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Job No.</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issueRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.detectedJobId ?? "-"}</TableCell>
                      <TableCell>{row.detectedClientName ?? "-"}</TableCell>
                      <TableCell>{row.detectedJobName ?? "-"}</TableCell>
                      <TableCell className="text-destructive">{row.errorMessage ?? row.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Link className="mt-3 inline-block text-sm text-primary hover:underline" href={`/imports/${batch.id}/errors`}>
                View all error rows
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No duplicate or error rows detected.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
