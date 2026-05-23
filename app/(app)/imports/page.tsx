import Link from "next/link";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { cn, formatDateTime } from "@/lib/utils";

export default async function ImportsPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const batches = await prisma.importBatch.findMany({
    select: {
      id: true,
      fileName: true,
      status: true,
      uploadedAt: true,
      xpmDownloadedAt: true,
      newJobsCount: true,
      missingJobsCount: true,
      stateUpdatedCount: true,
      completedStateCount: true,
      cancelledStateCount: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        action={user.role === "ADMIN" ? { href: "/imports/upload", label: "Upload File" } : undefined}
        description="Import batches are staged first and only applied after preview confirmation."
        title="Import History"
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Uploaded At</TableHead>
              <TableHead>XPM File Exported At</TableHead>
              <TableHead>State Updated</TableHead>
              <TableHead>New Jobs</TableHead>
              <TableHead>Missing</TableHead>
              <TableHead>Completed/Cancelled</TableHead>
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
                <TableCell>{formatDateTime(batch.xpmDownloadedAt)}</TableCell>
                <TableCell>{batch.stateUpdatedCount}</TableCell>
                <TableCell>{batch.newJobsCount}</TableCell>
                <TableCell>{batch.missingJobsCount}</TableCell>
                <TableCell>{batch.completedStateCount + batch.cancelledStateCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {user.role === "ADMIN" ? (
        <div className="mt-4">
          <Link className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")} href="/imports/upload">
            <FileUp className="h-4 w-4" />
            Upload another file
          </Link>
        </div>
      ) : null}
    </>
  );
}
