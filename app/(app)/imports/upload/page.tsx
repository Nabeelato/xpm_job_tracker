import { Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { maxUploadSizeBytes, requiredUploadHeaders } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { stageImportAction } from "../actions";

export default async function UploadImportPage() {
  await requireRole(["ADMIN", "MANAGER"]);

  return (
    <>
      <PageHeader description="Upload the daily CSV/XLSX source file. Nothing is applied until you confirm the preview." title="Upload Source File" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Source File</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={stageImportAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="file">
                CSV or XLSX file
              </label>
              <Input accept=".csv,.xlsx" id="file" name="file" required type="file" />
              <p className="text-xs text-muted-foreground">Maximum size: {Math.floor(maxUploadSizeBytes / 1024 / 1024)}MB</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">Required headers</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {requiredUploadHeaders.map((header) => (
                  <li key={header}>{header}</li>
                ))}
              </ul>
            </div>
            <Button type="submit">
              <Upload className="h-4 w-4" />
              Stage import
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
