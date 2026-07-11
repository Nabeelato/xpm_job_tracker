import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { JobFilters, type JobTabsConfig } from "@/components/job-filters";
import { JobsTableClient, type JobRow } from "@/components/jobs-table-client";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { managerUserRoles } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { JobStateGroup } from "@/lib/job-state";
import { buildJobReportOrderBy, buildJobReportWhere } from "@/lib/reports";
import { getSystemSetting } from "@/lib/settings";
import { requireUser } from "@/lib/rbac";
import { cn, parsePageSize, searchParam, toInt, toSearchParams, withPageSizeParam } from "@/lib/utils";

type Preset = {
  department?: string;
  stateSet?: "main" | "workflow" | "other";
  missing?: boolean;
  myJobs?: boolean;
  availableJobs?: boolean;
  queueVacancyFilters?: boolean;
  stateGroup?: JobStateGroup;
  stateNumbers?: number[];
  tabs?: JobTabsConfig;
};

function paramsWithPreset(params: URLSearchParams, preset: Preset) {
  const next = new URLSearchParams(params);
  if (preset.department) next.set("department", preset.department);
  if (preset.missing !== undefined) next.set("missing", String(preset.missing));
  if (preset.myJobs) next.set("myJobs", "true");
  if (preset.availableJobs) next.set("availableJobs", "true");
  const hasExplicitState =
    next.has("stateFilter") ||
    next.has("jobStateNumber") ||
    next.has("stateGroup") ||
    next.has("stateNumbers") ||
    next.has("stateSet");
  if (preset.stateSet && !hasExplicitState) next.set("stateSet", preset.stateSet);
  if (preset.stateGroup) next.set("stateGroup", preset.stateGroup);
  if (preset.stateNumbers?.length) next.set("stateNumbers", preset.stateNumbers.join(","));
  return next;
}

export async function JobListPage({
  title,
  description,
  searchParams,
  preset = {},
  basePath,
}: {
  title?: string;
  description?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  preset?: Preset;
  basePath: string;
}) {
  const user = await requireUser();
  const rawParams = (await searchParams) ?? {};
  const params = toSearchParams(rawParams);

  const effectivePreset: Preset = preset;
  const effectiveTitle = title ?? "";
  const effectiveDescription = description;

  const { pageSize, pageSizeOption } = parsePageSize(searchParam(rawParams, "pageSize"));
  const page = toInt(searchParam(rawParams, "page"), 1);
  const pageParams = withPageSizeParam(params, pageSizeOption);
  const filterParams = paramsWithPreset(pageParams, effectivePreset);
  const sortBy = searchParam(rawParams, "sortBy");
  const sortDir = (searchParam(rawParams, "sortDir") ?? "asc") as "asc" | "desc";
  const where = buildJobReportWhere(filterParams, user, { scope: "visible" });

  const showAssignmentAge = (await getSystemSetting("showAssignmentAge")) === "true";

  const [jobs, total, departments, users, workloadRows] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true,
        jobIdFromExcel: true,
        clientId: true,
        jobName: true,
        xpmState: true,
        jobStateNumber: true,
        missingFromLatestImport: true,
        client: { select: { displayName: true, category: true, bookkeepingSoftware: true, bookkeepingBy: true } },
        finalDepartment: { select: { code: true } },
        assignments: {
          where: { active: true },
          select: {
            id: true,
            assignmentRole: true,
            assignedAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: buildJobReportOrderBy(filterParams),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, supervisorId: true },
    }),
    // Active assignment counts per user, per department — workflow states 3-6 only
    prisma.jobAssignment.findMany({
      where: {
        active: true,
        job: { jobStateNumber: { in: [3, 4, 5, 6] } },
      },
      select: {
        userId: true,
        job: { select: { finalDepartment: { select: { code: true } } } },
      },
    }),
  ]);

  const isAdmin = user.role === "ADMIN";
  const isSupervisor = user.role === "SUPERVISOR";
  const managerUsers = users.filter((u) => managerUserRoles.includes(u.role));
  const supervisorUsers = users.filter((u) => u.role === "SUPERVISOR");

  const staffBySupId = new Map<string, { id: string; name: string | null }[]>();
  for (const u of users) {
    if (u.role === "STAFF" && u.supervisorId) {
      const list = staffBySupId.get(u.supervisorId) ?? [];
      list.push({ id: u.id, name: u.name });
      staffBySupId.set(u.supervisorId, list);
    }
  }

  // Build workload map: userId → { deptCode: count }
  const userWorkload: Record<string, Record<string, number>> = {};
  for (const row of workloadRows) {
    const deptCode = row.job.finalDepartment.code;
    if (!userWorkload[row.userId]) userWorkload[row.userId] = {};
    userWorkload[row.userId][deptCode] = (userWorkload[row.userId][deptCode] ?? 0) + 1;
  }

  const exportParams = new URLSearchParams(filterParams);
  exportParams.delete("page");
  exportParams.set("scope", "visible");
  const exportHref = `/api/reports/jobs/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <>
      <PageHeader description={effectiveDescription} title={effectiveTitle} />
      {effectivePreset.queueVacancyFilters ? (
        <div className="mb-4 flex flex-wrap gap-2 rounded-lg border bg-white p-3">
          {[
            ["", "All workflow jobs"],
            ["ANY", "Missing any role"],
            ["MANAGER", "No manager"],
            ["SUPERVISOR", "No supervisor"],
            ["STAFF", "No staff"],
            ["UNASSIGNED", "Completely unassigned"],
          ].map(([value, label]) => {
            const next = new URLSearchParams(pageParams);
            next.delete("page");
            if (value) next.set("queueVacancy", value);
            else next.delete("queueVacancy");
            const active = (searchParam(rawParams, "queueVacancy") ?? "") === value;
            return (
              <Link
                className={buttonVariants({ size: "sm", variant: active ? "default" : "outline" })}
                href={`${basePath}${next.toString() ? `?${next.toString()}` : ""}`}
                key={value || "all"}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <JobFilters
        basePath={basePath}
        config={effectivePreset.tabs}
        departments={departments}
        hasPresetState={Boolean(effectivePreset.stateGroup || effectivePreset.stateSet || effectivePreset.stateNumbers?.length)}
        lockedMissing={effectivePreset.missing !== undefined}
        params={filterParams.toString()}
        activeParams={pageParams.toString()}
        users={users}
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{jobs.length}</span> of{" "}
          <span className="font-medium text-foreground">{total}</span> matching jobs
        </span>
        <Link className={cn(buttonVariants({ variant: "outline" }), "self-start")} href={exportHref}>
          <Download className="h-4 w-4" />
          Export Excel
        </Link>
      </div>
      {jobs.length === 0 ? (
        <EmptyState
          description="Try adjusting the filters or uploading the latest source file."
          title="No jobs found"
        />
      ) : (
        <Suspense fallback={null}>
        <JobsTableClient
          currentUserId={user.id}
          currentUserRole={user.role}
          isAvailableQueue={Boolean(effectivePreset.availableJobs)}
          isMyJobs={Boolean(effectivePreset.myJobs)}
          isAdmin={isAdmin}
          isSupervisor={isSupervisor}
          showAssignmentAge={showAssignmentAge}
          sortBy={sortBy ?? ""}
          sortDir={sortDir}
          jobs={jobs.map((j): JobRow => {
            const supervisorUserId =
              j.assignments.find((a) => a.assignmentRole === "SUPERVISOR")?.user.id ?? null;
            return {
              id: j.id,
              jobIdFromExcel: j.jobIdFromExcel,
              clientId: j.clientId,
              clientName: j.client.displayName,
              clientCategory: j.client.category,
              bookkeepingSoftware: j.client.bookkeepingSoftware,
              bookkeepingBy: j.client.bookkeepingBy,
              jobName: j.jobName,
              departmentCode: j.finalDepartment.code,
              xpmState: j.xpmState,
              jobStateNumber: j.jobStateNumber,
              assignments: j.assignments,
              earliestAssignedAt:
                j.assignments.length > 0
                  ? j.assignments.reduce((earliest, a) =>
                      a.assignedAt < earliest ? a.assignedAt : earliest,
                      j.assignments[0].assignedAt,
                    )
                  : null,
              staffUsers: supervisorUserId ? (staffBySupId.get(supervisorUserId) ?? []) : [],
              supervisorMissing: !supervisorUserId,
            };
          })}
          managerUsers={managerUsers}
          staffBySupervisorId={Object.fromEntries(staffBySupId)}
          supervisorUsers={supervisorUsers}
          userWorkload={userWorkload}
        />
        </Suspense>
      )}
      <Pagination
        basePath={basePath}
        page={page}
        pageSize={pageSize}
        pageSizeOption={pageSizeOption}
        params={pageParams}
        total={total}
      />
    </>
  );
}
