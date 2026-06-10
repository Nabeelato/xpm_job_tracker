"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignJobRolesAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type RoleUser = { id: string; name: string | null };

type SelectedJob = {
  id: string;
  departmentCode: string;
};

export function AssignJobsModal({
  open,
  onClose,
  selectedJobs,
  managerUsers,
  supervisorUsers,
}: {
  open: boolean;
  onClose: () => void;
  selectedJobs: SelectedJob[];
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  // Close modal on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  // Count selected jobs by department
  const deptCounts: Record<string, number> = {};
  for (const job of selectedJobs) {
    deptCounts[job.departmentCode] = (deptCounts[job.departmentCode] ?? 0) + 1;
  }
  const deptSummary = Object.entries(deptCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => `${code}: ${count}`)
    .join("  |  ");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const manager = fd.get("managerUserId");
    const supervisor = fd.get("supervisorUserId");
    if (manager === "__skip__" && supervisor === "__skip__") {
      onClose();
      return;
    }
    startTransition(async () => {
      await bulkAssignJobRolesAction(fd);
      onClose();
      router.refresh();
    });
  }

  return (
    <dialog
      className="w-full max-w-md rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
      onClick={handleClick}
      ref={dialogRef}
    >
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Assign Jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedJobs.length} {selectedJobs.length === 1 ? "job" : "jobs"} selected
          </p>
          {deptSummary && (
            <p className="mt-1 text-xs font-mono text-muted-foreground">{deptSummary}</p>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input name="jobIds" type="hidden" value={selectedJobs.map((j) => j.id).join(",")} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Manager</span>
            <Select defaultValue="__skip__" name="managerUserId">
              <option value="__skip__">Don&apos;t change</option>
              <option value="">Clear (unassigned)</option>
              {managerUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Supervisor</span>
            <Select defaultValue="__skip__" name="supervisorUserId">
              <option value="__skip__">Don&apos;t change</option>
              <option value="">Clear (unassigned)</option>
              {supervisorUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              {isPending ? "Applying…" : "Apply"}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
