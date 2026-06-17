"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Input } from "@/components/ui/input";
import { maxUploadSizeBytes, requiredUploadHeaders } from "@/lib/constants";

const uploadErrors: Record<string, string> = {
  "missing-download-date": "Enter the date and time the XPM file was downloaded.",
  "download-date-future": "The XPM download time cannot be in the future.",
  "download-date-not-newer": "XPM download date/time must be after the last imported file's XPM date/time.",
};

function pad(n: number) {
  return `${n}`.padStart(2, "0");
}

function toLocalInputDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowInputDateTime() {
  return toLocalInputDateTime(new Date());
}

export function ImportUploadForm({
  action,
  errorCode,
  lastAppliedXpmAt,
  allowOverride = false,
}: {
  action: (formData: FormData) => void;
  errorCode?: string;
  lastAppliedXpmAt?: string | null;
  allowOverride?: boolean;
}) {
  const defaultValue = useMemo(() => nowInputDateTime(), []);
  const [overrideXpmDate, setOverrideXpmDate] = useState(false);
  const minValue = useMemo(() => {
    if (!lastAppliedXpmAt) return undefined;
    const d = new Date(lastAppliedXpmAt);
    if (Number.isNaN(d.getTime())) return undefined;
    // Add one minute so the input picker treats equal-to-last as invalid.
    return toLocalInputDateTime(new Date(d.getTime() + 60_000));
  }, [lastAppliedXpmAt]);
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
        const picked = new Date(downloadedAt);
        if (Number.isNaN(picked.getTime())) {
          event.preventDefault();
          window.alert(uploadErrors["missing-download-date"]);
          dateInputRef.current?.focus();
          return;
        }
        if (picked.getTime() > Date.now()) {
          event.preventDefault();
          window.alert(uploadErrors["download-date-future"]);
          dateInputRef.current?.focus();
          return;
        }
        if (!overrideXpmDate && lastAppliedXpmAt) {
          const last = new Date(lastAppliedXpmAt);
          if (!Number.isNaN(last.getTime()) && picked.getTime() <= last.getTime()) {
            event.preventDefault();
            window.alert(uploadErrors["download-date-not-newer"]);
            dateInputRef.current?.focus();
          }
        }
      }}
    >
      {errorMessage ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="xpmDownloadedAt">
          XPM file download date
        </label>
        <Input
          defaultValue={defaultValue}
          id="xpmDownloadedAt"
          max={nowInputDateTime()}
          min={overrideXpmDate ? undefined : minValue}
          name="xpmDownloadedAt"
          ref={dateInputRef}
          required
          type="datetime-local"
        />
      </div>
      {allowOverride ? (
        <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <input
            checked={overrideXpmDate}
            className="mt-1"
            name="overrideXpmDate"
            onChange={(event) => setOverrideXpmDate(event.target.checked)}
            type="checkbox"
            value="true"
          />
          <span>
            <span className="block font-medium">Admin override: allow older or same XPM file date</span>
            <span className="mt-1 block text-xs text-amber-900">
              Use this only to recover from a failed/crashed import. Future dates are still blocked.
            </span>
          </span>
        </label>
      ) : null}
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
