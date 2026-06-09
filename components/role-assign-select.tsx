"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { setJobRoleAssignmentAction } from "@/app/(app)/jobs/actions";

type UserOpt = { id: string; name: string | null };

export function RoleAssignSelect({
  jobId,
  role,
  current,
  users,
  disabled = false,
  disabledTitle,
  onAssigned,
}: {
  jobId: string;
  role: "MANAGER" | "SUPERVISOR" | "STAFF";
  current: UserOpt | null;
  users: UserOpt[];
  disabled?: boolean;
  disabledTitle?: string;
  onAssigned?: (userId: string | null) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentIsListed = current ? users.some((u) => u.id === current.id) : true;

  async function handleChange() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const userId = (fd.get("userId") as string) || null;
    setIsSubmitting(true);
    try {
      await setJobRoleAssignmentAction(fd);
      onAssigned?.(userId);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef}>
      <input name="jobId" type="hidden" value={jobId} />
      <input name="assignmentRole" type="hidden" value={role} />
      <span title={disabled ? disabledTitle : undefined}>
        <Select
          className="min-w-[140px]"
          defaultValue={current?.id ?? ""}
          disabled={disabled || isSubmitting}
          name="userId"
          onChange={handleChange}
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
      </span>
    </form>
  );
}
