"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setJobRoleAssignmentAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type RoleUser = { id: string; name: string | null };

type Assignment = {
  id: string;
  assignmentRole: string;
  user: { id: string; name: string | null };
};

function workloadLabel(userId: string, workload: Record<string, Record<string, number>>) {
  const counts = workload[userId];
  if (!counts) return "";
  const parts = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dept, count]) => `${dept}: ${count}`);
  if (parts.length === 0) return "";
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  return ` — ${parts.join(", ")} (${total} total)`;
}

export function AssignSingleJobModal({
  open,
  onClose,
  job,
  managerUsers,
  supervisorUsers,
  staffBySupervisorId,
  userWorkload,
}: {
  open: boolean;
  onClose: () => void;
  job: {
    id: string;
    jobIdFromExcel: string;
    clientName: string;
    departmentCode: string;
    assignments: Assignment[];
  };
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
  staffBySupervisorId: Record<string, RoleUser[]>;
  userWorkload: Record<string, Record<string, number>>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null); // role currently saving

  // Local state so dropdowns are instant
  const [managerVal, setManagerVal] = useState(
    job.assignments.find((a) => a.assignmentRole === "MANAGER")?.user.id ?? ""
  );
  const [supervisorVal, setSupervisorVal] = useState(
    job.assignments.find((a) => a.assignmentRole === "SUPERVISOR")?.user.id ?? ""
  );
  const [staffVal, setStaffVal] = useState(
    job.assignments.find((a) => a.assignmentRole === "STAFF")?.user.id ?? ""
  );

  // Reset local state when a new job is opened
  useEffect(() => {
    setManagerVal(job.assignments.find((a) => a.assignmentRole === "MANAGER")?.user.id ?? "");
    setSupervisorVal(job.assignments.find((a) => a.assignmentRole === "SUPERVISOR")?.user.id ?? "");
    setStaffVal(job.assignments.find((a) => a.assignmentRole === "STAFF")?.user.id ?? "");
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Staff list derived from currently selected supervisor — updates instantly on supervisor change
  const staffUsers = supervisorVal ? (staffBySupervisorId[supervisorVal] ?? []) : [];

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) handleClose();
  }

  function handleClose() {
    onClose();
  }

  async function assignRole(role: "MANAGER" | "SUPERVISOR" | "STAFF", userId: string | null) {
    setSaving(role);
    const fd = new FormData();
    fd.append("jobId", job.id);
    fd.append("assignmentRole", role);
    fd.append("userId", userId ?? "");
    await setJobRoleAssignmentAction(fd);
    setSaving(null);
    router.refresh(); // refresh after each save — non-blocking, modal stays open
  }

  function RoleSelect({
    role,
    value,
    onChange,
    users,
  }: {
    role: "MANAGER" | "SUPERVISOR" | "STAFF";
    value: string;
    onChange: (v: string) => void;
    users: RoleUser[];
  }) {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium capitalize">{role.toLowerCase()}</span>
        <Select
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            void assignRole(role, next || null);
          }}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}{workloadLabel(u.id, userWorkload)}
            </option>
          ))}
        </Select>
        {saving === role && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
      </label>
    );
  }

  return (
    <dialog
      className="w-full max-w-md rounded-xl border bg-background p-0 shadow-xl backdrop:bg-black/40"
      onClick={handleClick}
      ref={dialogRef}
    >
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Assign Job</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.jobIdFromExcel} — {job.clientName}
          </p>
          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {job.departmentCode}
          </span>
        </div>

        <div className="space-y-3">
          <RoleSelect role="MANAGER" value={managerVal} onChange={setManagerVal} users={managerUsers} />
          <RoleSelect
          role="SUPERVISOR"
          value={supervisorVal}
          onChange={(v) => {
            setSupervisorVal(v);
            setStaffVal(""); // clear staff when supervisor changes
          }}
          users={supervisorUsers}
        />
          <RoleSelect role="STAFF" value={staffVal} onChange={setStaffVal} users={staffUsers} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleClose} type="button" variant="outline">
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}
