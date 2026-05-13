import Link from "next/link";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { cn, formatDateTime } from "@/lib/utils";

export default async function ImportsPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const batches = await prisma.importBatch.findMany({
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      totalRows: true,
      newJobsCount: true,
      updatedJobsCount: true,
      errorRowsCount: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader action={{ href: "/imports/upload", label: "Upload File" }} description="Import batches are staged first and only applied after preview confirmation." title="Import History" />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Uploaded At</TableHead>
              <TableHead>Total Rows</TableHead>
              <TableHead>New</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">
                  <Link className="text-primary hover:underline" href={batch.status === "STAGED" ? `/imports/${batch.id}/preview` : `/imports/${batch.id}`}>
                    {batch.fileName}
                  </Link>
                </TableCell>
                <TableCell>{batch.status}</TableCell>
                <TableCell>{batch.uploadedBy.name}</TableCell>
                <TableCell>{formatDateTime(batch.uploadedAt)}</TableCell>
                <TableCell>{batch.totalRows}</TableCell>
                <TableCell>{batch.newJobsCount}</TableCell>
                <TableCell>{batch.updatedJobsCount}</TableCell>
                <TableCell>
                  {batch.errorRowsCount ? (
                    <Link className="text-destructive hover:underline" href={`/imports/${batch.id}/errors`}>
                      {batch.errorRowsCount}
                    </Link>
                  ) : (
                    0
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4">
        <Link className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")} href="/imports/upload">
          <FileUp className="h-4 w-4" />
          Upload another file
        </Link>
      </div>
    </>
  );
}
