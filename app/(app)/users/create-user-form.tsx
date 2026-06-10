"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { userRoles } from "@/lib/constants";
import { titleCaseEnum } from "@/lib/utils";
import { createUserAction, type ActionResult } from "./actions";

type Department = { id: string; name: string };
type Supervisor = { id: string; name: string };

export function CreateUserForm({
  departments,
  supervisors,
}: {
  departments: Department[];
  supervisors: Supervisor[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createUserAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-3" ref={formRef}>
      <Input name="name" placeholder="Name" required />
      <Input name="username" placeholder="Username (e.g. HashirShami1052)" required type="text" />
      <Input minLength={8} name="password" placeholder="Temporary password" required type="password" />
      <Select name="role" required>
        {userRoles.map((role) => (
          <option key={role} value={role}>
            {titleCaseEnum(role)}
          </option>
        ))}
      </Select>
      <Select name="departmentId" defaultValue="">
        <option value="">No department</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </Select>
      <Select name="supervisorId" defaultValue="">
        <option value="">No supervisor</option>
        {supervisors.map((supervisor) => (
          <option key={supervisor.id} value={supervisor.id}>
            {supervisor.name}
          </option>
        ))}
      </Select>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-700">User created.</p>
      )}
      <Button disabled={pending} type="submit">
        {pending ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
