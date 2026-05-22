import type { Prisma } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { JobFilters } from "@/components/job-filters";
import { JobFilterTabs, type JobTabsConfig } from "@/components/job-filter-tabs";
import { JobsTableClient, type JobRow } from "@/components/jobs-table-client";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import { stateGroupWhere, type JobStateGroup } from "@/lib/job-state";
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

  const where: Prisma.JobWhereInput = { AND: and };

  const [jobs, total, departments, users] = await Promise.all([
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
        client: { select: { displayName: true, category: true } },
        finalDepartment: { select: { code: true } },
        assignments: {
          where: { active: true },
          select: {
            id: true,
            assignmentRole: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: [{ missingFromLatestImport: "desc" }, { updatedAt: "desc" }],
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
      select: { id: true, name: true, role: true },
    }),
  ]);

  const isAdmin = user.role === "ADMIN";
  const managerUsers = users.filter((u) => u.role === "MANAGER");
  const supervisorUsers = users.filter((u) => u.role === "SUPERVISOR");

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
        <JobsTableClient
          isAdmin={isAdmin}
          jobs={jobs.map(
            (j): JobRow => ({
              id: j.id,
              jobIdFromExcel: j.jobIdFromExcel,
              clientId: j.clientId,
              clientName: j.client.displayName,
              clientCategory: j.client.category,
              jobName: j.jobName,
              departmentCode: j.finalDepartment.code,
              xpmState: j.xpmState,
              assignments: j.assignments,
            }),
          )}
          managerUsers={managerUsers}
          supervisorUsers={supervisorUsers}
        />
      )}
      <Pagination basePath={basePath} page={page} pageSize={pageSize} params={params} total={total} />
    </>
  );
}
