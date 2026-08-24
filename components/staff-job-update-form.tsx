"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStaffJobAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type StaffJobUpdateValue = {
  status: "DONE" | null;
  comment: string | null;
  updatedAt: Date | null;
};

export function StaffJobUpdateForm({
  jobId,
  initialStatus,
  initialComment,
  onSaved,
}: {
  jobId: string;
  initialStatus: "DONE" | null;
  initialComment: string | null;
  onSaved?: (value: StaffJobUpdateValue) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(initialStatus ?? "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus ?? "");
    setComment(initialComment ?? "");
  }, [initialComment, initialStatus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await updateStaffJobAction(formData);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved?.({ status: result.status, comment: result.comment, updatedAt: result.updatedAt });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant={initialStatus === "DONE" ? "outline" : "default"}>
        {initialStatus === "DONE" ? "Update" : "Mark done"}
      </Button>
      <dialog
        className="w-full max-w-lg rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
        onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <form className="space-y-5 p-6" onSubmit={submit}>
          <div>
            <h2 className="text-lg font-semibold">Staff Job Update</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark your assigned work done and leave a note for the supervisor, manager, and admins.
            </p>
          </div>

          <input name="jobId" type="hidden" value={jobId} />
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Staff status</span>
            <Select name="staffStatus" onChange={(event) => setStatus(event.target.value as "" | "DONE")} value={status}>
              <option value="">Not done</option>
              <option value="DONE">Done</option>
            </Select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Staff comment</span>
            <Textarea
              maxLength={2000}
              name="staffComment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a note for the supervisor or manager (optional)"
              value={comment}
            />
            <span className="block text-right text-xs font-normal text-muted-foreground">{comment.length}/2000</span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button disabled={saving} onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button loading={saving} loadingLabel="Saving..." type="submit">Save update</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
