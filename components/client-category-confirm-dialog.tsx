"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PendingResolve = (value: "SOFTWARE" | "MANUAL" | null) => void;

export function useClientCategoryConfirm() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<PendingResolve | null>(null);
  const [prompt, setPrompt] = useState<{ assigneeName: string; clientName: string } | null>(null);

  function settle(value: "SOFTWARE" | "MANUAL" | null) {
    dialogRef.current?.close();
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPrompt(null);
  }

  function confirm(assigneeName: string, clientName: string) {
    return new Promise<"SOFTWARE" | "MANUAL" | null>((resolve) => {
      resolveRef.current = resolve;
      setPrompt({ assigneeName, clientName });
      dialogRef.current?.showModal();
    });
  }

  const dialog = (
    <dialog
      className="w-full max-w-md rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); settle(null); }}
      onClick={(event) => { if (event.target === dialogRef.current) settle(null); }}
      ref={dialogRef}
    >
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Confirm client type</h2>
          {prompt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {prompt.assigneeName} manages both software and manual bookkeeping clients. Is{" "}
              <strong>{prompt.clientName}</strong> a software client or a manual client?
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => settle(null)} type="button" variant="outline">Cancel assignment</Button>
          <Button onClick={() => settle("MANUAL")} type="button" variant="outline">Manual client</Button>
          <Button onClick={() => settle("SOFTWARE")} type="button">Software client</Button>
        </div>
      </div>
    </dialog>
  );

  return { confirm, dialog };
}
