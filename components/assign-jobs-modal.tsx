"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignJobRolesAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type RoleUser = { id: string; name: string | null };
type SelectedJob = { id: string; departmentCode: string };
type Role = "MANAGER" | "SUPERVISOR" | "STAFF" | "ALL";

export function AssignJobsModal({ open, onClose, selectedJobs, managerUsers, supervisorUsers, staffUsers }: {
  open: boolean; onClose: () => void; selectedJobs: SelectedJob[];
  managerUsers: RoleUser[]; supervisorUsers: RoleUser[]; staffUsers: RoleUser[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"ASSIGN" | "UNASSIGN">("ASSIGN");
  const [role, setRole] = useState<Role>("MANAGER");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const counts: Record<string, number> = {};
  for (const job of selectedJobs) counts[job.departmentCode] = (counts[job.departmentCode] ?? 0) + 1;
  const summary = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => `${code}: ${count}`).join(" | ");
  const users = role === "MANAGER" ? managerUsers : role === "SUPERVISOR" ? supervisorUsers : staffUsers;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = operation === "UNASSIGN"
      ? `Remove ${role === "ALL" ? "all" : role.toLowerCase()} assignments from ${selectedJobs.length} selected jobs?`
      : `Add this ${role.toLowerCase()} to ${selectedJobs.length} selected jobs? Existing assignments will remain.`;
    if (!confirm(message)) return;
    startTransition(async () => {
      await bulkAssignJobRolesAction(formData);
      onClose();
      router.refresh();
    });
  }

  return (
    <dialog className="w-full max-w-md rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }} ref={dialogRef}>
      <div className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Bulk Assign / Unassign</h2>
          <p className="mt-1 text-sm text-muted-foreground">{selectedJobs.length} jobs selected across all departments</p>
          {summary ? <p className="mt-1 text-xs font-mono text-muted-foreground">{summary}</p> : null}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <input name="jobIds" type="hidden" value={selectedJobs.map((job) => job.id).join(",")} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Action</span>
            <Select name="operation" value={operation} onChange={(event) => {
              const next = event.target.value as "ASSIGN" | "UNASSIGN";
              setOperation(next);
              if (next === "ASSIGN" && role === "ALL") setRole("MANAGER");
            }}>
              <option value="ASSIGN">Assign user</option><option value="UNASSIGN">Unassign</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Role</span>
            <Select name="assignmentRole" value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {operation === "UNASSIGN" ? <option value="ALL">All roles / everyone</option> : null}
              <option value="MANAGER">Managers / Admins</option><option value="SUPERVISOR">Supervisors</option>
              <option value="STAFF">Staff</option>
            </Select>
          </label>
          {role !== "ALL" ? <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">User {operation === "UNASSIGN" ? "(optional)" : ""}</span>
            <Select defaultValue="" name="userId" required={operation === "ASSIGN"}>
              <option value="">{operation === "UNASSIGN" ? "All users in this role" : "Select user…"}</option>
              {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name ?? candidate.id}</option>)}
            </Select>
          </label> : null}
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Assign adds without replacing existing users. Unassign can remove one user, a complete role, or every assignment.
          </p>
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={isPending} type="submit" variant={operation === "UNASSIGN" ? "destructive" : "default"}>
              {isPending ? "Applying…" : operation === "ASSIGN" ? "Assign selected" : "Unassign selected"}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
