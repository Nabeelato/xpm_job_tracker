"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/select";
import { setJobRoleAssignmentAction } from "@/app/(app)/jobs/actions";

type UserOpt = { id: string; name: string | null };

export function RoleAssignSelect({
  jobId,
  role,
  current,
  users,
}: {
  jobId: string;
  role: "MANAGER" | "SUPERVISOR";
  current: UserOpt | null;
  users: UserOpt[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const currentIsListed = current ? users.some((u) => u.id === current.id) : true;

  return (
    <form action={setJobRoleAssignmentAction} ref={formRef}>
      <input name="jobId" type="hidden" value={jobId} />
      <input name="assignmentRole" type="hidden" value={role} />
      <Select
        className="min-w-[140px]"
        defaultValue={current?.id ?? ""}
        name="userId"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="">Unassigned</option>
        {current && !currentIsListed ? (
          <option value={current.id}>{current.name ?? current.id} (other role)</option>
        ) : null}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ?? u.id}
          </option>
        ))}
      </Select>
    </form>
  );
}
