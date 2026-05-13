"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Input } from "@/components/ui/input";
import { maxUploadSizeBytes, requiredUploadHeaders } from "@/lib/constants";

const uploadErrors: Record<string, string> = {
  "missing-download-date": "Enter the date when the file was downloaded from XPM.",
  "download-date-past": "The XPM download date cannot be earlier than today's upload date. Please download a fresh file from XPM.",
  "download-date-future": "The XPM download date cannot be after today's upload date.",
};

function todayInputDate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ImportUploadForm({
  action,
  errorCode,
}: {
  action: (formData: FormData) => void;
  errorCode?: string;
}) {
  const today = useMemo(() => todayInputDate(), []);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const errorMessage = errorCode ? uploadErrors[errorCode] : "";

  useEffect(() => {
    if (errorMessage) window.alert(errorMessage);
  }, [errorMessage]);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        const downloadedAt = dateInputRef.current?.value;
        if (!downloadedAt) {
          event.preventDefault();
          window.alert(uploadErrors["missing-download-date"]);
          dateInputRef.current?.focus();
          return;
        }
        if (downloadedAt < today) {
          event.preventDefault();
          window.alert(uploadErrors["download-date-past"]);
          dateInputRef.current?.focus();
          return;
        }
        if (downloadedAt > today) {
          event.preventDefault();
          window.alert(uploadErrors["download-date-future"]);
          dateInputRef.current?.focus();
        }
      }}
    >
      {errorMessage ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currentUploadDate">
            Current upload date
          </label>
          <Input id="currentUploadDate" readOnly type="date" value={today} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="xpmDownloadedAt">
            When did you download the file from XPM?
          </label>
          <Input defaultValue={today} id="xpmDownloadedAt" max={today} name="xpmDownloadedAt" ref={dateInputRef} required type="date" />
        </div>
      </div>
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
      <FormSubmitButton pendingLabel="Staging import...">
        <Upload className="h-4 w-4" />
        Stage import
      </FormSubmitButton>
    </form>
  );
}
