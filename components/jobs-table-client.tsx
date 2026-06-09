"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookkeepingBy, BookkeepingSoftware, ClientCategory } from "@prisma/client";
import { bookkeepingSoftwareLabels } from "@/lib/constants";
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
  bookkeepingSoftware: BookkeepingSoftware | null;
  bookkeepingBy: BookkeepingBy | null;
  jobName: string;
  departmentCode: string;
  xpmState: string | null;
  assignments: Assignment[];
  staffUsers: { id: string; name: string | null }[];
  supervisorMissing: boolean;
};

export function JobsTableClient({
  jobs,
  isAdmin,
  isSupervisor = false,
  currentUserId,
  managerUsers,
  supervisorUsers,
  staffBySupervisorId,
}: {
  jobs: JobRow[];
  isAdmin: boolean;
  isSupervisor?: boolean;
  currentUserId?: string;
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
  staffBySupervisorId: Record<string, RoleUser[]>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  // Local optimistic overrides so Staff dropdown updates immediately when supervisor changes
  const [supervisorOverrides, setSupervisorOverrides] = useState<Record<string, boolean>>({});
  const [staffOverrides, setStaffOverrides] = useState<Record<string, RoleUser[]>>({});

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

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
    e.preventDefault();
    startTransition(async () => {
      await bulkAssignJobRolesAction(fd);
      setSelected(new Set());
      router.refresh();
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
              <TableHead>Bookkeeping</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Staff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const manager = job.assignments.find((a) => a.assignmentRole === "MANAGER")?.user ?? null;
              const supervisor = job.assignments.find((a) => a.assignmentRole === "SUPERVISOR")?.user ?? null;
              const staff = job.assignments.find((a) => a.assignmentRole === "STAFF")?.user ?? null;
              const isChecked = selected.has(job.id);
              // Use local overrides if available, fall back to server-computed values
              const effectiveSupervisorMissing =
                job.id in supervisorOverrides ? !supervisorOverrides[job.id] : job.supervisorMissing;
              const effectiveStaffUsers =
                job.id in staffOverrides ? staffOverrides[job.id] : job.staffUsers;
              // Supervisor can edit staff only on rows where they are the assigned supervisor
              const isAssignedSupervisor = isSupervisor && !!currentUserId && supervisor?.id === currentUserId;
              const canEditStaff = isAdmin || isAssignedSupervisor;
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
                  <TableCell className="text-sm text-muted-foreground">
                    {job.bookkeepingSoftware
                      ? `${bookkeepingSoftwareLabels[job.bookkeepingSoftware]}${job.bookkeepingBy === "CLIENT" ? " - Client" : ""}`
                      : "-"}
                  </TableCell>
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
                        onAssigned={(userId) => {
                          setSupervisorOverrides((prev) => ({ ...prev, [job.id]: !!userId }));
                          setStaffOverrides((prev) => ({
                            ...prev,
                            [job.id]: userId ? (staffBySupervisorId[userId] ?? []) : [],
                          }));
                        }}
                        role="SUPERVISOR"
                        users={supervisorUsers}
                      />
                    ) : (
                      <span className={supervisor ? "" : "text-muted-foreground"}>
                        {supervisor?.name ?? "Unassigned"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEditStaff ? (
                      <RoleAssignSelect
                        current={staff}
                        disabled={effectiveSupervisorMissing}
                        disabledTitle="Assign a supervisor first"
                        jobId={job.id}
                        role="STAFF"
                        users={effectiveStaffUsers}
                      />
                    ) : (
                      <span className={staff ? "" : "text-muted-foreground"}>
                        {staff?.name ?? "Unassigned"}
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
