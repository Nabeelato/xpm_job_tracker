import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export default async function ImportErrorsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const rows = await prisma.importRow.findMany({
    where: { importBatchId: id, action: { in: ["ERROR", "DUPLICATE_IN_FILE"] } },
    select: {
      id: true,
      rowNumber: true,
      action: true,
      detectedJobId: true,
      detectedClientName: true,
      detectedJobName: true,
      errorMessage: true,
    },
    orderBy: { rowNumber: "asc" },
  });

  return (
    <>
      <PageHeader description="Rows here were not applied to main job/client tables." title="Import Error Rows" />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Job No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.rowNumber}</TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell>{row.detectedJobId ?? "-"}</TableCell>
                <TableCell>{row.detectedClientName ?? "-"}</TableCell>
                <TableCell>{row.detectedJobName ?? "-"}</TableCell>
                <TableCell className="text-destructive">{row.errorMessage ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
