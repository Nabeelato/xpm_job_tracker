import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { JobFilters } from "@/components/job-filters";
import { JobFilterTabs, type JobTabsConfig } from "@/components/job-filter-tabs";
import { JobsTableClient, type JobRow } from "@/components/jobs-table-client";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import { stateGroupWhere, xpmSubStateWhere, type JobStateGroup, type XpmSubState } from "@/lib/job-state";
import { getSystemSetting } from "@/lib/settings";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";
import { searchParam, toInt } from "@/lib/utils";

type Preset = {
  department?: string;
  missing?: boolean;
  myJobs?: boolean;
  stateGroup?: JobStateGroup;
  stateNumbers?: number[];
  tabs?: JobTabsConfig;
};

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
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value) params.set(key, value);
  }

  const effectivePreset: Preset = preset;
  const effectiveTitle = title ?? "";
  const effectiveDescription = description;

  const page = toInt(searchParam(rawParams, "page"), 1);
  const pageSize = 25;
  const query = searchParam(rawParams, "q");
  const department = effectivePreset.department ?? searchParam(rawParams, "department");
  const jobStateNumber = toInt(searchParam(rawParams, "jobStateNumber"), 0);
  const stateSet = searchParam(rawParams, "stateSet");
  const priority = searchParam(rawParams, "priority");
  const assignedUserId = searchParam(rawParams, "assignedUserId");
  const sourceManager = searchParam(rawParams, "sourceManager");
  const sourcePartner = searchParam(rawParams, "sourcePartner");
  const missingParam =
    effectivePreset.missing === undefined ? searchParam(rawParams, "missing") : String(effectivePreset.missing);
  const archivedParam = searchParam(rawParams, "archived") ?? "false";
  const xpmSubState = searchParam(rawParams, "xpmSubState") as XpmSubState | null;
  const sortBy = searchParam(rawParams, "sortBy");
  const sortDir = (searchParam(rawParams, "sortDir") ?? "asc") as "asc" | "desc";

  const and: Prisma.JobWhereInput[] = [visibleJobsWhere(user)];
  if (effectivePreset.myJobs) and.push({ assignments: { some: { userId: user.id, active: true } } });
  if (query) {
    and.push({
      OR: [
        { jobIdFromExcel: { contains: query, mode: "insensitive" } },
        { jobName: { contains: query, mode: "insensitive" } },
        { client: { displayName: { contains: query, mode: "insensitive" } } },
      ],
    });
  }
  if (department) and.push({ finalDepartment: { code: department } });
  if (
    jobStateNumber > 0 &&
    (!effectivePreset.stateNumbers?.length || effectivePreset.stateNumbers.includes(jobStateNumber))
  ) {
    and.push({ jobStateNumber });
  } else if (effectivePreset.stateNumbers?.length) {
    and.push({ jobStateNumber: { in: effectivePreset.stateNumbers } });
  } else if (!effectivePreset.stateGroup && stateSet === "main") {
    and.push({ jobStateNumber: { in: [2, 3, 4, 5, 6] } });
  } else if (!effectivePreset.stateGroup && stateSet === "workflow") {
    and.push({ jobStateNumber: { in: [3, 4, 5, 6] } });
  } else if (!effectivePreset.stateGroup && stateSet === "other") {
    and.push(stateGroupWhere("OTHER"));
  }
  if (effectivePreset.stateGroup) and.push(stateGroupWhere(effectivePreset.stateGroup));
  if (priority) and.push({ priority: { contains: priority, mode: "insensitive" } });
  if (assignedUserId === "unassigned") {
    and.push({ assignments: { none: { active: true } } });
  } else if (assignedUserId) {
    and.push({ assignments: { some: { userId: assignedUserId, active: true } } });
  }
  if (sourceManager) and.push({ sourceManagerName: { contains: sourceManager, mode: "insensitive" } });
  if (sourcePartner) and.push({ sourcePartnerName: { contains: sourcePartner, mode: "insensitive" } });
  if (missingParam === "true") and.push({ missingFromLatestImport: true });
  if (missingParam === "false") and.push({ missingFromLatestImport: false });
  if (archivedParam === "true") and.push({ archived: true });
  if (archivedParam === "false") and.push({ archived: false });
  if (xpmSubState === "ifza_check" || xpmSubState === "job_on_hold") and.push(xpmSubStateWhere(xpmSubState));

  const where: Prisma.JobWhereInput = { AND: and };

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
      orderBy: (() => {
        const dir = sortDir === "desc" ? "desc" : "asc";
        switch (sortBy) {
          case "jobNo":       return [{ jobIdFromExcel: dir }] as Prisma.JobOrderByWithRelationInput[];
          case "client":     return [{ client: { displayName: dir } }, { jobIdFromExcel: "asc" }] as Prisma.JobOrderByWithRelationInput[];
          case "jobName":    return [{ jobName: dir }, { jobIdFromExcel: "asc" }] as Prisma.JobOrderByWithRelationInput[];
          case "department": return [{ finalDepartment: { code: dir } }, { jobIdFromExcel: "asc" }] as Prisma.JobOrderByWithRelationInput[];
          case "state":      return [{ jobStateNumber: dir }, { jobIdFromExcel: "asc" }] as Prisma.JobOrderByWithRelationInput[];
          default:           return [{ missingFromLatestImport: "desc" }, { jobIdFromExcel: "asc" }] as Prisma.JobOrderByWithRelationInput[];
        }
      })(),
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
  const managerUsers = users.filter((u) => u.role === "MANAGER");
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

  return (
    <>
      <PageHeader description={effectiveDescription} title={effectiveTitle} />
      <JobFilterTabs
        basePath={basePath}
        config={effectivePreset.tabs}
        departments={departments}
        params={params}
        users={users}
      />
      <JobFilters
        departments={departments}
        hidden={{
          assignedUserId: effectivePreset.tabs?.assignees,
          department: effectivePreset.tabs?.departments,
          jobStateNumber: Boolean(effectivePreset.tabs?.states || effectivePreset.tabs?.stateSets),
        }}
        params={params}
        users={users}
      />
      {jobs.length === 0 ? (
        <EmptyState
          description="Try adjusting the filters or uploading the latest source file."
          title="No jobs found"
        />
      ) : (
        <Suspense fallback={null}>
        <JobsTableClient
          currentUserId={user.id}
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
      <Pagination basePath={basePath} page={page} pageSize={pageSize} params={params} total={total} />
    </>
  );
}
