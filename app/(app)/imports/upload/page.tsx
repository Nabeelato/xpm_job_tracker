import { ImportUploadForm } from "@/components/import-upload-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/rbac";
import { stageImportAction } from "../actions";

export default async function UploadImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["ADMIN"]);
  const { error } = await searchParams;

  return (
    <>
      <PageHeader description="Upload the daily CSV/XLSX source file. Nothing is applied until you confirm the preview." title="Upload Source File" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Source File</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportUploadForm action={stageImportAction} errorCode={error} />
        </CardContent>
      </Card>
    </>
  );
}
