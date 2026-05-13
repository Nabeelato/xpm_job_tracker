import { ImportBatchBreakdown } from "@/components/import-batch-breakdown";
import { ImportSummaryCards } from "@/components/import-summary-cards";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

const comparisonSections = [
  { category: "STATE_UPDATED", title: "State Updated" },
  { category: "STATE_UNCHANGED", title: "State Unchanged / Untouched" },
  { category: "MOVED_OUT_OF_MAIN", title: "Moved Out of Main" },
  { category: "MISSING_FROM_UPLOAD", title: "Missing From Latest Import" },
] as const;

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
      <PageHeader description={`${batch.fileName} | ${batch.status} | ${formatDateTime(batch.uploadedAt)}`} title="Import Batch Detail" />
      <ImportSummaryCards batch={batch} />
      <ImportBatchBreakdown rows={batch.rows} />
      <div className="mt-5 grid gap-5">
        {comparisonSections.map((section) => {
          const rows = batch.rows.filter((row) => row.stateComparisonCategory === section.category).slice(0, 50);
          return (
            <Card key={section.category}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Job No.</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Previous Source State</TableHead>
                        <TableHead>New Source State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>{row.detectedJobId ?? "-"}</TableCell>
                          <TableCell>{row.detectedClientName ?? "-"}</TableCell>
                          <TableCell>{row.previousXpmState ?? "-"}</TableCell>
                          <TableCell>{row.newXpmState ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No rows in this section.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
