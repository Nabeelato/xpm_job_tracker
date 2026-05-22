"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { ClientCategory } from "@prisma/client";
import { DepartmentBadge } from "@/components/department-badge";
import { RoleAssignSelect } from "@/components/role-assign-select";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { bulkAssignJobRolesAction } from "@/app/(app)/jobs/actions";

type RoleUser = { id: string; name: string | null };

type Assignment = {
  id: string;
  assignmentRole: string;
  user: { id: string; name: string | null };
};

export type JobRow = {
  id: string;
  jobIdFromExcel: string;
  clientId: string;
  clientName: string;
  clientCategory: ClientCategory | null;
  jobName: string;
  departmentCode: string;
  xpmState: string | null;
  assignments: Assignment[];
};

export function JobsTableClient({
  jobs,
  isAdmin,
  managerUsers,
  supervisorUsers,
}: {
  jobs: JobRow[];
  isAdmin: boolean;
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const allOnPageSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  const visibleIds = useMemo(() => jobs.map((j) => j.id), [jobs]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const manager = fd.get("managerUserId");
    const supervisor = fd.get("supervisorUserId");
    if (manager === "__skip__" && supervisor === "__skip__") {
      e.preventDefault();
      return;
    }
    startTransition(() => {
      // Let the form action fire; once it resolves, server revalidates /jobs
      // and Next refreshes the route segment — selection is cleared below.
      setTimeout(() => setSelected(new Set()), 0);
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {isAdmin && selectedCount > 0 ? (
        <form
          action={bulkAssignJobRolesAction}
          className="flex flex-wrap items-end gap-3 rounded-lg border bg-primary/5 p-3"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <input name="jobIds" type="hidden" value={[...selected].join(",")} />
          <div className="flex-1 min-w-[180px] text-sm">
            <div className="font-semibold">
              {selectedCount} {selectedCount === 1 ? "job" : "jobs"} selected
            </div>
            <div className="text-xs text-muted-foreground">Assign to:</div>
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Manager</span>
            <Select className="min-w-[160px]" defaultValue="__skip__" name="managerUserId">
              <option value="__skip__">Don&apos;t change</option>
              <option value="">Unassigned (clear)</option>
              {managerUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Supervisor</span>
            <Select className="min-w-[160px]" defaultValue="__skip__" name="supervisorUserId">
              <option value="__skip__">Don&apos;t change</option>
              <option value="">Unassigned (clear)</option>
              {supervisorUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </Select>
          </label>
          <Button disabled={isPending} size="sm" type="submit">
            {isPending ? "Applying…" : "Apply"}
          </Button>
          <Button onClick={clearSelection} size="sm" type="button" variant="ghost">
            Clear
          </Button>
        </form>
      ) : null}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin ? (
                <TableHead className="w-8">
                  <input
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    type="checkbox"
                  />
                </TableHead>
              ) : null}
              <TableHead>Job No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Source State</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Supervisor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const manager = job.assignments.find((a) => a.assignmentRole === "MANAGER")?.user ?? null;
              const supervisor = job.assignments.find((a) => a.assignmentRole === "SUPERVISOR")?.user ?? null;
              const isChecked = selected.has(job.id);
              const isSoftware = job.clientCategory === "SOFTWARE";
              return (
                <TableRow
                  className={cn(
                    isSoftware && "bg-yellow-100 hover:bg-yellow-200",
                    isChecked && "bg-primary/10 hover:bg-primary/15",
                  )}
                  key={job.id}
                >
                  {isAdmin ? (
                    <TableCell className="w-8">
                      <input
                        aria-label={`Select ${job.jobIdFromExcel}`}
                        checked={isChecked}
                        onChange={() => toggleOne(job.id)}
                        type="checkbox"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    <Link className="text-primary hover:underline" href={`/jobs/${job.id}`}>
                      {job.jobIdFromExcel}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link className="hover:underline" href={`/clients/${job.clientId}`}>
                      {job.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md">{job.jobName}</TableCell>
                  <TableCell>
                    <DepartmentBadge code={job.departmentCode} />
                  </TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{job.xpmState ?? "-"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <RoleAssignSelect
                        current={manager}
                        jobId={job.id}
                        role="MANAGER"
                        users={managerUsers}
                      />
                    ) : (
                      <span className={manager ? "" : "text-muted-foreground"}>
                        {manager?.name ?? "Unassigned"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <RoleAssignSelect
                        current={supervisor}
                        jobId={job.id}
                        role="SUPERVISOR"
                        users={supervisorUsers}
                      />
                    ) : (
                      <span className={supervisor ? "" : "text-muted-foreground"}>
                        {supervisor?.name ?? "Unassigned"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
