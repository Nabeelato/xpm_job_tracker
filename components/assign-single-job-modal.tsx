"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleJobAssignmentAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";

type AssignmentRole = "MANAGER" | "SUPERVISOR" | "STAFF";
type UserRole = "ADMIN" | "MANAGER" | "SUPERVISOR" | "STAFF";
type RoleUser = { id: string; name: string | null; disabled?: boolean };
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
  currentUserId,
  currentUserRole,
  managerUsers,
  supervisorUsers,
  crossRoleStaffUsers,
  staffBySupervisorId,
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
  currentUserId: string;
  currentUserRole: UserRole;
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
  crossRoleStaffUsers: RoleUser[];
  staffBySupervisorId: Record<string, RoleUser[]>;
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

  const assignedSupervisorIds = assignments
    .filter((assignment) => assignment.assignmentRole === "SUPERVISOR")
    .map((assignment) => assignment.user.id);
  const staffUsers = useMemo(() => {
    const supervisorIds = currentUserRole === "SUPERVISOR" ? [currentUserId] : assignedSupervisorIds;
    const unique = new Map<string, RoleUser>();
    for (const supervisorId of supervisorIds) {
      for (const staff of staffBySupervisorId[supervisorId] ?? []) unique.set(staff.id, staff);
    }
    for (const candidate of crossRoleStaffUsers) unique.set(candidate.id, candidate);
    return [...unique.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [assignedSupervisorIds.join(","), crossRoleStaffUsers, currentUserId, currentUserRole, staffBySupervisorId]);

  async function toggle(role: AssignmentRole, target: RoleUser, checked: boolean) {
    const key = `${role}:${target.id}`;
    setSavingKey(key);
    const nextAssignments = checked
      ? [...assignments, { id: `pending-${key}`, assignedAt: new Date(), assignmentRole: role, user: target }]
      : assignments.filter((assignment) => !(assignment.assignmentRole === role && assignment.user.id === target.id));
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
    return (
      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-semibold capitalize">{role.toLowerCase()}s</legend>
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
          {candidates.length ? candidates.map((candidate) => {
            const key = `${role}:${candidate.id}`;
            return (
              <label
                className={candidate.disabled
                  ? "flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground"
                  : "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"}
                key={candidate.id}
                title={candidate.disabled ? "Only an administrator can change this assignment." : undefined}
              >
                <input
                  checked={assignedIds.has(candidate.id)}
                  disabled={candidate.disabled || savingKey === key}
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
          <h2 className="text-lg font-semibold">Assign Multiple Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">{job.jobIdFromExcel} — {job.clientName}</p>
          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{job.departmentCode}</span>
        </div>

        <div className="space-y-3">
          {currentUserRole !== "SUPERVISOR" ? <RoleChecklist role="MANAGER" users={managerUsers} /> : null}
          <RoleChecklist role="SUPERVISOR" users={supervisorUsers} />
          <RoleChecklist role="STAFF" users={staffUsers} />
          {currentUserRole !== "SUPERVISOR" && assignedSupervisorIds.length === 0 && crossRoleStaffUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Assign at least one supervisor to select staff from their teams.</p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} type="button" variant="outline">Close</Button>
        </div>
      </div>
    </dialog>
  );
}
