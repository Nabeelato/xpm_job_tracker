"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { userRoles } from "@/lib/constants";
import { titleCaseEnum } from "@/lib/utils";
import { createUserAction, type ActionResult } from "./actions";

type Department = { id: string; name: string };
type HierarchyParent = { id: string; name: string; role: string; departmentId: string | null };

export function CreateUserForm({
  departments,
  hierarchyParents,
}: {
  departments: Department[];
  hierarchyParents: HierarchyParent[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createUserAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("ADMIN");
  const [departmentId, setDepartmentId] = useState("");
  const eligibleParents = hierarchyParents.filter((parent) => {
    if (!departmentId || parent.departmentId !== departmentId) return false;
    if (role === "STAFF") return parent.role === "SUPERVISOR";
    if (role === "SUPERVISOR") return parent.role === "ADMIN" || parent.role === "MANAGER";
    if (role === "MANAGER") return parent.role === "ADMIN";
    return false;
  });

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setRole("ADMIN");
      setDepartmentId("");
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="space-y-3" ref={formRef}>
      <Input name="name" placeholder="Name" required />
      <Input name="username" placeholder="Username (e.g. HashirShami1052)" required type="text" />
      <Input minLength={8} name="password" placeholder="Temporary password" required type="password" />
      <Select name="role" onChange={(event) => setRole(event.target.value)} required value={role}>
        {userRoles.map((role) => (
          <option key={role} value={role}>
            {titleCaseEnum(role)}
          </option>
        ))}
      </Select>
      <Select name="departmentId" onChange={(event) => setDepartmentId(event.target.value)} value={departmentId}>
        <option value="">No department</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </Select>
      <Select key={`${role}:${departmentId}`} name="supervisorId" required={role === "STAFF"} defaultValue="">
        <option value="">{role === "STAFF" ? "Select team supervisor" : "No hierarchy parent"}</option>
        {eligibleParents.map((parent) => (
          <option key={parent.id} value={parent.id}>
            {parent.name} ({parent.role})
          </option>
        ))}
      </Select>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-700">User created.</p>
      )}
      <Button disabled={pending} loading={pending} loadingLabel="Creating..." type="submit">
        Create user
      </Button>
    </form>
  );
}
