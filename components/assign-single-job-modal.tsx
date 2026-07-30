"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleJobAssignmentAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";

type AssignmentRole = "MANAGER" | "SUPERVISOR" | "STAFF";
type UserRole = "ADMIN" | "MANAGER" | "SUPERVISOR" | "STAFF";
type RoleUser = { id: string; name: string | null; supervisorId?: string | null; disabled?: boolean };
type Assignment = {
  id: string;
  assignmentRole: string;
  assignedAt: Date;
  user: { id: string; name: string | null };
};

function workloadLabel(userId: string, workload: Record<string, Record<string, number>>) {
  const counts = workload[userId];
  if (!counts) return "";
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return total ? ` (${total} active)` : "";
}

export function AssignSingleJobModal({
  open,
  onClose,
  onAssignmentsChange,
  job,
  currentUserRole,
  managerUsers,
  supervisorUsers,
  staffUsers,
  userWorkload,
}: {
  open: boolean;
  onClose: () => void;
  onAssignmentsChange?: (assignments: Assignment[]) => void;
  job: {
    id: string;
    jobIdFromExcel: string;
    clientName: string;
    departmentCode: string;
    assignments: Assignment[];
  };
  currentUserRole: UserRole;
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
  staffUsers: RoleUser[];
  userWorkload: Record<string, Record<string, number>>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [assignments, setAssignments] = useState(job.assignments);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => setAssignments(job.assignments), [job.id, job.assignments]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function toggle(role: AssignmentRole, target: RoleUser, checked: boolean) {
    const key = `${role}:${target.id}`;
    setSavingKey(key);
    let nextAssignments = checked
      ? [
          ...assignments.filter((assignment) => role === "MANAGER" || assignment.assignmentRole !== role),
          { id: `pending-${key}`, assignedAt: new Date(), assignmentRole: role, user: target },
        ]
      : assignments.filter((assignment) => !(assignment.assignmentRole === role && assignment.user.id === target.id));
    if (checked && role === "STAFF" && target.supervisorId) {
      const supervisor = supervisorUsers.find((candidate) => candidate.id === target.supervisorId);
      if (supervisor) {
        nextAssignments = [
          ...nextAssignments.filter((assignment) => assignment.assignmentRole !== "SUPERVISOR"),
          {
            id: `pending-SUPERVISOR:${supervisor.id}`,
            assignedAt: new Date(),
            assignmentRole: "SUPERVISOR",
            user: supervisor,
          },
        ];
      }
    }
    setAssignments(nextAssignments);
    onAssignmentsChange?.(nextAssignments);

    const formData = new FormData();
    formData.set("jobId", job.id);
    formData.set("userId", target.id);
    formData.set("assignmentRole", role);
    formData.set("assigned", String(checked));
    await toggleJobAssignmentAction(formData);
    setSavingKey(null);
    router.refresh();
  }

  function RoleChecklist({ role, users }: { role: AssignmentRole; users: RoleUser[] }) {
    const roleAssignments = assignments.filter((assignment) => assignment.assignmentRole === role);
    const assignedIds = new Set(roleAssignments.map((assignment) => assignment.user.id));
    const visibleUsers = new Map(users.map((candidate) => [candidate.id, candidate]));
    for (const assignment of roleAssignments) {
      if (!visibleUsers.has(assignment.user.id)) {
        visibleUsers.set(assignment.user.id, {
          ...assignment.user,
          disabled: currentUserRole !== "ADMIN",
        });
      }
    }
    const candidates = [...visibleUsers.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const exclusiveRoleOccupied = role !== "MANAGER" && roleAssignments.length > 0;
    return (
      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-semibold capitalize">{role.toLowerCase()}s</legend>
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
          {candidates.length ? candidates.map((candidate) => {
            const key = `${role}:${candidate.id}`;
            const assigned = assignedIds.has(candidate.id);
            const blockedByExclusiveAssignment = exclusiveRoleOccupied && !assigned;
            return (
              <label
                className={candidate.disabled || blockedByExclusiveAssignment
                  ? "flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground"
                  : "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"}
                key={candidate.id}
                title={candidate.disabled
                  ? "Only an administrator can change this assignment."
                  : blockedByExclusiveAssignment
                    ? `Remove the current ${role.toLowerCase()} before assigning another.`
                    : undefined}
              >
                <input
                  checked={assigned}
                  disabled={candidate.disabled || blockedByExclusiveAssignment || savingKey === key}
                  onChange={(event) => void toggle(role, candidate, event.target.checked)}
                  type="checkbox"
                />
                <span className="flex-1">{candidate.name ?? candidate.id}{workloadLabel(candidate.id, userWorkload)}</span>
                {candidate.disabled ? <span className="text-xs">Admin only</span> : null}
                {savingKey === key ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
              </label>
            );
          }) : <p className="px-2 py-1 text-sm text-muted-foreground">No eligible users.</p>}
        </div>
      </fieldset>
    );
  }

  return (
    <dialog
      className="w-full max-w-lg rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      ref={dialogRef}
    >
      <div className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">Assign Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">{job.jobIdFromExcel} — {job.clientName}</p>
          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{job.departmentCode}</span>
        </div>

        <div className="space-y-3">
          {currentUserRole !== "SUPERVISOR" ? <RoleChecklist role="MANAGER" users={managerUsers} /> : null}
          <RoleChecklist role="SUPERVISOR" users={supervisorUsers} />
          <RoleChecklist role="STAFF" users={staffUsers} />
          <p className="text-xs text-muted-foreground">A job can have multiple managers, but only one supervisor and one staff member.</p>
          {currentUserRole !== "SUPERVISOR" ? (
            <p className="text-xs text-muted-foreground">Selecting staff automatically assigns their configured supervisor.</p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} type="button" variant="outline">Close</Button>
        </div>
      </div>
    </dialog>
  );
}
