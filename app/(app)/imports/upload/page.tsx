import { ImportStatus } from "@prisma/client";
import { ImportUploadForm } from "@/components/import-upload-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { stageImportAction } from "../actions";

export default async function UploadImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { error } = await searchParams;

  const lastApplied = await prisma.importBatch.findFirst({
    where: { status: ImportStatus.APPLIED, xpmDownloadedAt: { not: null } },
    orderBy: { xpmDownloadedAt: "desc" },
    select: { xpmDownloadedAt: true, fileName: true },
  });

  return (
    <>
      <PageHeader description="Upload the daily CSV/XLSX source file. Nothing is applied until you confirm the preview." title="Upload Source File" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Source File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">Last imported file</div>
            {lastApplied?.xpmDownloadedAt ? (
              <div className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">{lastApplied.fileName}</span>
                <span> — XPM file date: </span>
                <span className="font-medium text-foreground">{formatDateTime(lastApplied.xpmDownloadedAt)}</span>
              </div>
            ) : (
              <div className="mt-1 text-muted-foreground">No previous imports.</div>
            )}
          </div>
          <ImportUploadForm
            action={stageImportAction}
            errorCode={error}
            lastAppliedXpmAt={lastApplied?.xpmDownloadedAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
    </>
  );
}
