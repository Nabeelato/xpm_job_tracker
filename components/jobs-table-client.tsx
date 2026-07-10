"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import type { BookkeepingBy, BookkeepingSoftware, ClientCategory } from "@prisma/client";
import { bookkeepingSoftwareLabels } from "@/lib/constants";
import { AssignJobsModal } from "@/components/assign-jobs-modal";
import { AssignSingleJobModal } from "@/components/assign-single-job-modal";
import { DepartmentBadge } from "@/components/department-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { bulkOwnJobsAction, claimJobAction, releaseOwnJobAction } from "@/app/(app)/jobs/actions";

type RoleUser = { id: string; name: string | null };

type Assignment = {
  id: string;
  assignmentRole: string;
  assignedAt: Date;
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
  jobStateNumber: number | null;
  assignments: Assignment[];
  staffUsers: { id: string; name: string | null }[];
  supervisorMissing: boolean;
  earliestAssignedAt: Date | null;
};

export function JobsTableClient({
  jobs,
  isAdmin,
  isSupervisor = false,
  currentUserId,
  currentUserRole,
  managerUsers,
  supervisorUsers,
  staffBySupervisorId,
  showAssignmentAge = false,
  userWorkload = {},
  sortBy = "",
  sortDir = "asc",
}: {
  jobs: JobRow[];
  isAdmin: boolean;
  isSupervisor?: boolean;
  currentUserId?: string;
  currentUserRole: "ADMIN" | "MANAGER" | "SUPERVISOR" | "STAFF";
  managerUsers: RoleUser[];
  supervisorUsers: RoleUser[];
  staffBySupervisorId: Record<string, RoleUser[]>;
  showAssignmentAge?: boolean;
  userWorkload?: Record<string, Record<string, number>>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [selectionLoaded, setSelectionLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSort(col: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("sortBy") === col) {
      params.set("sortDir", params.get("sortDir") === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", col);
      params.set("sortDir", "asc");
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  }

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`job-selection:${currentUserId}`);
      if (saved) setSelected(new Map(JSON.parse(saved) as Array<[string, string]>));
    } catch { /* Ignore invalid browser storage. */ }
    setSelectionLoaded(true);
  }, [currentUserId]);

  useEffect(() => {
    if (!selectionLoaded) return;
    sessionStorage.setItem(`job-selection:${currentUserId}`, JSON.stringify([...selected.entries()]));
  }, [currentUserId, selected, selectionLoaded]);

  const allOnPageSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  const visibleIds = useMemo(() => jobs.map((j) => j.id), [jobs]);

  function toggleOne(job: JobRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(job.id)) next.delete(job.id);
      else next.set(job.id, job.departmentCode);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPageSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        jobs.forEach((job) => next.set(job.id, job.departmentCode));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Map());
  }

  const selectedCount = selected.size;
  const selectedJobsForModal = useMemo(
    () => [...selected.entries()].map(([id, departmentCode]) => ({ id, departmentCode })),
    [selected],
  );

  async function runBulkOwnAction(operation: "CLAIM" | "RELEASE") {
    if (!confirm(`${operation === "CLAIM" ? "Claim" : "Remove from your list"} ${selectedCount} selected jobs?`)) return;
    const formData = new FormData();
    formData.set("operation", operation);
    for (const id of selected.keys()) formData.append("jobId", id);
    await bulkOwnJobsAction(formData);
    clearSelection();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (isAdmin || currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR") ? (
        <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
          <span className="flex-1 text-sm font-semibold">
            {selectedCount} {selectedCount === 1 ? "job" : "jobs"} selected
          </span>
          {isAdmin ? <Button onClick={() => setModalOpen(true)} size="sm">Bulk assign / unassign</Button> : (
            <>
              <Button onClick={() => void runBulkOwnAction("CLAIM")} size="sm">Bulk claim</Button>
              <Button onClick={() => void runBulkOwnAction("RELEASE")} size="sm" variant="destructive">Bulk remove</Button>
            </>
          )}
          <Button onClick={clearSelection} size="sm" variant="ghost">
            Clear
          </Button>
        </div>
      ) : null}

      <AssignJobsModal
        managerUsers={managerUsers}
        onClose={() => {
          setModalOpen(false);
          setSelected(new Map());
        }}
        open={modalOpen}
        selectedJobs={selectedJobsForModal}
        staffUsers={Array.from(new Map(
          Object.values(staffBySupervisorId).flat().map((staff) => [staff.id, staff]),
        ).values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))}
        supervisorUsers={supervisorUsers}
      />

      {(() => {
        const assigningJob = assigningJobId ? jobs.find((j) => j.id === assigningJobId) : null;
        if (!assigningJob) return null;
        return (
          <AssignSingleJobModal
            currentUserId={currentUserId ?? ""}
            currentUserRole={currentUserRole}
            job={{
              id: assigningJob.id,
              jobIdFromExcel: assigningJob.jobIdFromExcel,
              clientName: assigningJob.clientName,
              departmentCode: assigningJob.departmentCode,
              assignments: assigningJob.assignments,
            }}
            managerUsers={managerUsers}
            onClose={() => setAssigningJobId(null)}
            open={true}
            staffBySupervisorId={staffBySupervisorId}
            supervisorUsers={supervisorUsers}
            userWorkload={userWorkload}
          />
        );
      })()}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {(isAdmin || currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR") ? (
                <TableHead className="w-8">
                  <input
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    type="checkbox"
                  />
                </TableHead>
              ) : null}
              <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("jobNo")}>Job No.<SortIcon col="jobNo" /></TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("client")}>Client<SortIcon col="client" /></TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("jobName")}>Job Name<SortIcon col="jobName" /></TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("department")}>Department<SortIcon col="department" /></TableHead>
              <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort("state")}>Source State<SortIcon col="state" /></TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead />
              {showAssignmentAge ? <TableHead>Assigned</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const roleNames = (role: string) => job.assignments
                .filter((a) => a.assignmentRole === role)
                .map((a) => a.user.name ?? a.user.id)
                .join(", ");
              const manager = roleNames("MANAGER");
              const supervisor = roleNames("SUPERVISOR");
              const staff = roleNames("STAFF");
              const claimRole = currentUserRole === "STAFF" ? "STAFF" :
                currentUserRole === "SUPERVISOR" ? "SUPERVISOR" : "MANAGER";
              const isClaimable = currentUserRole !== "ADMIN" &&
                !job.assignments.some((assignment) => assignment.assignmentRole === claimRole) &&
                Boolean(job.jobStateNumber && [3, 4, 5, 6].includes(job.jobStateNumber));
              const ownAssignment = job.assignments.find((assignment) =>
                assignment.user.id === currentUserId && assignment.assignmentRole === claimRole,
              );
              const isChecked = selected.has(job.id);
              // Use local overrides if available, fall back to server-computed values
              const isSoftware = job.clientCategory === "SOFTWARE";
              const isCancelled = job.jobStateNumber === 12;
              const isCompleted = job.jobStateNumber === 11;
              return (
                <TableRow
                  className={cn(
                    isSoftware && "bg-yellow-100 hover:bg-yellow-200",
                    isCompleted && "bg-green-50 hover:bg-green-100 dark:bg-green-950/20",
                    isCancelled && "bg-red-50 hover:bg-red-100 dark:bg-red-950/20",
                    isChecked && "bg-primary/10 hover:bg-primary/15",
                  )}
                  key={job.id}
                >
                  {(isAdmin || currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR") ? (
                    <TableCell className="w-8">
                      <input
                        aria-label={`Select ${job.jobIdFromExcel}`}
                        checked={isChecked}
                        onChange={() => toggleOne(job)}
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link className="hover:underline" href={`/clients/${job.clientId}`}>
                        {job.clientName}
                      </Link>
                      {job.bookkeepingSoftware ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {bookkeepingSoftwareLabels[job.bookkeepingSoftware]}
                          {job.bookkeepingBy === "CLIENT" ? " - Client" : ""}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">{job.jobName}</TableCell>
                  <TableCell>
                    <DepartmentBadge code={job.departmentCode} />
                  </TableCell>
                  <TableCell className="max-w-xs text-muted-foreground">{job.xpmState ?? "-"}</TableCell>
                  <TableCell>
                    <span className={manager ? "text-sm" : "text-sm text-muted-foreground"}>
                      {manager || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={supervisor ? "text-sm" : "text-sm text-muted-foreground"}>
                      {supervisor || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={staff ? "text-sm" : "text-sm text-muted-foreground"}>
                      {staff || "—"}
                    </span>
                  </TableCell>
                  {isClaimable ? (
                    <TableCell>
                      <Button
                        disabled={claimingJobId === job.id}
                        onClick={async () => {
                          setClaimingJobId(job.id);
                          const formData = new FormData();
                          formData.set("jobId", job.id);
                          await claimJobAction(formData);
                          router.refresh();
                          setClaimingJobId(null);
                        }}
                        size="sm"
                        type="button"
                      >
                        {claimingJobId === job.id ? "Claiming…" : "Claim job"}
                      </Button>
                    </TableCell>
                  ) : ownAssignment && (currentUserRole === "MANAGER" || currentUserRole === "SUPERVISOR") ? (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button onClick={async () => {
                          if (!confirm("Remove this job from your list?")) return;
                          const formData = new FormData(); formData.set("jobId", job.id);
                          await releaseOwnJobAction(formData); router.refresh();
                        }} size="sm" type="button" variant="destructive">Remove from my list</Button>
                        <Button onClick={() => setAssigningJobId(job.id)} size="sm" type="button" variant="outline">Assign</Button>
                      </div>
                    </TableCell>
                  ) : (isAdmin || isSupervisor || currentUserRole === "MANAGER") ? (
                    <TableCell>
                      <Button
                        onClick={() => setAssigningJobId(job.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Assign
                      </Button>
                    </TableCell>
                  ) : <TableCell />}
                  {showAssignmentAge ? (
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {job.earliestAssignedAt
                        ? formatDistanceToNowStrict(job.earliestAssignedAt, { addSuffix: true })
                        : "-"}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
