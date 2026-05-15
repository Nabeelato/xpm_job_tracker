"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assignmentRoles } from "@/lib/constants";
import { titleCaseEnum } from "@/lib/utils";
import { bulkAssignByIdsAction } from "@/app/(app)/jobs/actions";

export type BulkAssignJob = {
  id: string;
  jobIdFromExcel: string;
  clientName: string;
  jobName: string;
  departmentCode: string | null;
  internalStatus: string;
  assigneeNames: string[];
};

export type BulkAssignUser = {
  id: string;
  name: string;
  role: string;
};

export function BulkAssignClient({ jobs, users }: { jobs: BulkAssignJob[]; users: BulkAssignUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [quickIds, setQuickIds] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<string>(assignmentRoles[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [result, setResult] = useState<{ ok: boolean; count: number } | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((j) => {
      const matchSearch =
        !q ||
        j.jobIdFromExcel.toLowerCase().includes(q) ||
        j.clientName.toLowerCase().includes(q) ||
        j.jobName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || j.internalStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [jobs, search, statusFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((j) => selectedIds.has(j.id));
  const someFilteredSelected = filtered.some((j) => selectedIds.has(j.id));

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((j) => next.delete(j.id));
      } else {
        filtered.forEach((j) => next.add(j.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyQuickSelect() {
    const ids = quickIds
      .split(/[\r\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (!ids.length) return;
    const matched = new Set(jobs.filter((j) => ids.includes(j.jobIdFromExcel.toUpperCase())).map((j) => j.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      matched.forEach((id) => next.add(id));
      return next;
    });
    setQuickIds("");
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleAssign() {
    if (!selectedIds.size || !userId || !assignmentRole) return;
    const formData = new FormData();
    formData.set("jobIds", [...selectedIds].join(","));
    formData.set("userId", userId);
    formData.set("assignmentRole", assignmentRole);

    startTransition(async () => {
      await bulkAssignByIdsAction(formData);
      setResult({ ok: true, count: selectedIds.size });
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  const uniqueStatuses = useMemo(() => [...new Set(jobs.map((j) => j.internalStatus))].sort(), [jobs]);

  return (
    <div className="space-y-6">
      {/* Quick-select by Job IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Select by Job IDs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            Paste Job IDs (comma or newline separated) to select them instantly in the table below.
          </p>
          <div className="flex gap-2">
            <Textarea
              className="h-20 font-mono text-xs"
              onChange={(e) => setQuickIds(e.target.value)}
              placeholder={"J000008\nJ000014\nJ001500"}
              value={quickIds}
            />
            <Button className="self-end" onClick={applyQuickSelect} type="button" variant="secondary">
              Select matching
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Job ID, Client or Job Name…"
          type="search"
          value={search}
        />
        <Select onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}>
          <option value="all">All statuses</option>
          {uniqueStatuses.map((s) => (
            <option key={s} value={s}>
              {titleCaseEnum(s)}
            </option>
          ))}
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} jobs shown · {selectedIds.size} selected
        </span>
        {selectedIds.size > 0 && (
          <button className="text-xs text-destructive underline" onClick={clearSelection} type="button">
            Clear selection
          </button>
        )}
      </div>

      {/* Job table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      aria-label="Select all visible"
                      checked={allFilteredSelected}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      onChange={toggleAll}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                      }}
                      type="checkbox"
                    />
                  </TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell className="py-8 text-center text-muted-foreground" colSpan={7}>
                      No jobs match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((job) => (
                  <TableRow
                    className="cursor-pointer select-none hover:bg-muted/50"
                    data-selected={selectedIds.has(job.id) || undefined}
                    key={job.id}
                    onClick={() => toggleOne(job.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`Select ${job.jobIdFromExcel}`}
                        checked={selectedIds.has(job.id)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                        onChange={() => toggleOne(job.id)}
                        type="checkbox"
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{job.jobIdFromExcel}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{job.clientName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{job.jobName}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {job.departmentCode ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{titleCaseEnum(job.internalStatus)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {job.assigneeNames.length ? job.assigneeNames.join(", ") : "Unassigned"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assign controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign Selected Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {result && (
            <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
              {result.count} job{result.count !== 1 ? "s" : ""} assigned successfully.
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Assign to</label>
              <Select onChange={(e) => setUserId(e.target.value)} required value={userId}>
                <option value="">Select user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select onChange={(e) => setAssignmentRole(e.target.value)} value={assignmentRole}>
                {assignmentRoles.map((role) => (
                  <option key={role} value={role}>
                    {titleCaseEnum(role)}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              disabled={!selectedIds.size || !userId || isPending}
              onClick={handleAssign}
              type="button"
            >
              {isPending ? "Assigning…" : `Assign ${selectedIds.size || ""} selected job${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
          {!selectedIds.size && (
            <p className="mt-2 text-xs text-muted-foreground">Select at least one job from the table above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
