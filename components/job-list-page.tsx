import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DepartmentBadge } from "@/components/department-badge";
import { EmptyState } from "@/components/empty-state";
import { JobFilters } from "@/components/job-filters";
import { JobFilterTabs, type JobTabsConfig } from "@/components/job-filter-tabs";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { getStaleLevel, hoursInState, stateGroupWhere, type JobStateGroup } from "@/lib/job-state";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";
import { cn, searchParam, toInt } from "@/lib/utils";

type Preset = {
  department?: string;
  missing?: boolean;
  myJobs?: boolean;
  stateGroup?: JobStateGroup;
  stateNumbers?: number[];
  staleHours?: number;
  tabs?: JobTabsConfig;
};

export async function JobListPage({
  title,
  description,
  searchParams,
  preset = {},
  basePath,
}: {
  title: string;
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

  const page = toInt(searchParam(rawParams, "page"), 1);
  const pageSize = 25;
  const query = searchParam(rawParams, "q");
  const department = preset.department ?? searchParam(rawParams, "department");
  const internalStatus = searchParam(rawParams, "internalStatus");
  const jobStateNumber = toInt(searchParam(rawParams, "jobStateNumber"), 0);
  const stateSet = searchParam(rawParams, "stateSet");
  const priority = searchParam(rawParams, "priority");
  const assignedUserId = searchParam(rawParams, "assignedUserId");
  const sourceManager = searchParam(rawParams, "sourceManager");
  const sourcePartner = searchParam(rawParams, "sourcePartner");
  const missingParam = preset.missing === undefined ? searchParam(rawParams, "missing") : String(preset.missing);
  const archivedParam = searchParam(rawParams, "archived") ?? "false";

  const and: Prisma.JobWhereInput[] = [visibleJobsWhere(user)];
  if (preset.myJobs) and.push({ assignments: { some: { userId: user.id, active: true } } });
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
  if (internalStatus) and.push({ internalStatus: internalStatus as Prisma.EnumInternalStatusFilter<"Job"> });
  if (jobStateNumber > 0 && (!preset.stateNumbers?.length || preset.stateNumbers.includes(jobStateNumber))) {
    and.push({ jobStateNumber });
  } else if (preset.stateNumbers?.length) {
    and.push({ jobStateNumber: { in: preset.stateNumbers } });
  } else if (!preset.stateGroup && stateSet === "main") {
    and.push({ jobStateNumber: { in: [2, 3, 4, 5, 6] } });
  } else if (!preset.stateGroup && stateSet === "workflow") {
    and.push({ jobStateNumber: { in: [3, 4, 5, 6] } });
  } else if (!preset.stateGroup && stateSet === "other") {
    and.push(stateGroupWhere("OTHER"));
  }
  if (preset.stateGroup) and.push(stateGroupWhere(preset.stateGroup));
  if (preset.staleHours) {
    const threshold = new Date(Date.now() - preset.staleHours * 60 * 60 * 1000);
    and.push({
      jobStateNumber: { in: [3, 4, 5, 6] },
      stateEnteredAt: { lte: threshold },
    });
  }
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
        stateEnteredAt: true,
        internalStatus: true,
        missingFromLatestImport: true,
        client: { select: { displayName: true } },
        finalDepartment: { select: { code: true } },
        assignments: {
          where: { active: true },
          select: { user: { select: { name: true } } },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: [{ missingFromLatestImport: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
    prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title={title} description={description} />
      <JobFilterTabs basePath={basePath} config={preset.tabs} departments={departments} params={params} users={users} />
      <JobFilters
        hidden={{
          assignedUserId: preset.tabs?.assignees,
          department: preset.tabs?.departments,
          jobStateNumber: Boolean(preset.tabs?.states || preset.tabs?.stateSets),
        }}
        params={params}
        departments={departments}
        users={users}
      />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs found" description="Try adjusting the filters or uploading the latest source file." />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job No.</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Job Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Source State</TableHead>
                <TableHead>Internal</TableHead>
                <TableHead>Assigned Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const staleLevel = getStaleLevel(job.jobStateNumber, job.stateEnteredAt);
                const staleHours = hoursInState(job.stateEnteredAt);
                return (
                  <TableRow
                    className={cn(
                      staleLevel === "warning" && "bg-red-50",
                      staleLevel === "critical" && "bg-red-950 text-white hover:bg-red-900",
                    )}
                    key={job.id}
                  >
                    <TableCell className="font-medium">
                      <Link className={cn("text-primary hover:underline", staleLevel === "critical" && "text-white")} href={`/jobs/${job.id}`}>
                        {job.jobIdFromExcel}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link className="hover:underline" href={`/clients/${job.clientId}`}>
                        {job.client.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-md">{job.jobName}</TableCell>
                    <TableCell>
                      <DepartmentBadge code={job.finalDepartment.code} />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-col gap-1">
                        <span className={cn("text-muted-foreground", staleLevel === "critical" && "text-red-100")}>{job.xpmState ?? "-"}</span>
                        {staleLevel !== "none" ? (
                          <Badge variant={staleLevel === "critical" ? "destructive" : "warning"}>
                            {staleLevel === "critical" ? "48h+ unchanged" : "24h+ unchanged"}
                            {typeof staleHours === "number" ? ` (${staleHours}h)` : ""}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={job.internalStatus} />
                    </TableCell>
                    <TableCell className={cn("text-muted-foreground", staleLevel === "critical" && "text-red-100")}>
                      {job.assignments.length ? job.assignments.map((assignment) => assignment.user.name).join(", ") : "Unassigned"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination basePath={basePath} page={page} pageSize={pageSize} params={params} total={total} />
    </>
  );
}
