import Link from "next/link";
import { AssignmentRole } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  isJobExceptionFilter,
  isOpenAssignmentExceptionJob,
  jobExceptionWhere,
  missingAssignmentWhere,
  unclassifiedJobWhere,
} from "@/lib/job-exceptions";
import { requireRole } from "@/lib/rbac";
import { cn, parsePageSize, searchParam, toInt, toSearchParams } from "@/lib/utils";

export default async function ExceptionReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["ADMIN"]);
  const rawParams = (await searchParams) ?? {};
  const requestedType = searchParam(rawParams, "type");
  const type = isJobExceptionFilter(requestedType) ? requestedType : "all";
  const query = searchParam(rawParams, "q")?.trim() ?? "";
  const page = toInt(searchParam(rawParams, "page"), 1);
  const { pageSize, pageSizeOption } = parsePageSize(searchParam(rawParams, "pageSize"));
  const baseWhere = jobExceptionWhere(type);
  const where = query
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { jobIdFromExcel: { contains: query, mode: "insensitive" as const } },
              { jobName: { contains: query, mode: "insensitive" as const } },
              { client: { displayName: { contains: query, mode: "insensitive" as const } } },
              { sourceManagerName: { contains: query, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const [jobs, total, allCount, unclassifiedCount, missingStaffCount, missingSupervisorCount] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ jobStateNumber: "asc" }, { jobIdFromExcel: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        jobIdFromExcel: true,
        jobName: true,
        jobStateNumber: true,
        xpmState: true,
        archived: true,
        sourceManagerName: true,
        client: { select: { displayName: true } },
        finalDepartment: { select: { code: true, name: true } },
        assignments: {
          where: { active: true, user: { active: true } },
          orderBy: { assignedAt: "desc" },
          select: { assignmentRole: true, user: { select: { name: true } } },
        },
      },
    }),
    prisma.job.count({ where }),
    prisma.job.count({ where: jobExceptionWhere("all") }),
    prisma.job.count({ where: unclassifiedJobWhere() }),
    prisma.job.count({ where: missingAssignmentWhere(AssignmentRole.STAFF) }),
    prisma.job.count({ where: missingAssignmentWhere(AssignmentRole.SUPERVISOR) }),
  ]);

  const reportLinks = [
    { type: "all", label: "All exception jobs", count: allCount },
    { type: "unclassified", label: "Unclassified", count: unclassifiedCount },
    { type: "missing_staff", label: "Missing staff", count: missingStaffCount },
    { type: "missing_supervisor", label: "Missing supervisor", count: missingSupervisorCount },
  ] as const;
  const paginationParams = toSearchParams(rawParams);

  return (
    <>
      <PageHeader
        description="Live operational exceptions requiring administrator review. Completed and cancelled jobs are excluded from missing-assignment checks."
        title="Exception Reports"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {reportLinks.map((report) => (
          <Link href={`/reports/exceptions?type=${report.type}`} key={report.type}>
            <Card className={type === report.type ? "border-orange-300 bg-orange-50/60" : "transition hover:border-slate-300"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{report.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{report.count}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <form action="/reports/exceptions" className="mb-4 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[220px_1fr_auto]" method="GET">
        <Select defaultValue={type} name="type">
          <option value="all">All exceptions</option>
          <option value="unclassified">Unclassified</option>
          <option value="missing_staff">Missing staff</option>
          <option value="missing_supervisor">Missing supervisor</option>
        </Select>
        <Input defaultValue={query} name="q" placeholder="Search job no., client, job, or source manager" />
        <Button className="w-full md:w-auto" loadingLabel="Filtering..." type="submit">Filter report</Button>
      </form>

      {jobs.length ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Client / Job Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Source Manager</TableHead>
                <TableHead>Managers</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Exceptions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const managers = job.assignments
                  .filter((assignment) => assignment.assignmentRole === AssignmentRole.MANAGER)
                  .map((assignment) => assignment.user.name ?? "Unnamed user");
                const supervisor = job.assignments.find(
                  (assignment) => assignment.assignmentRole === AssignmentRole.SUPERVISOR,
                )?.user.name;
                const staff = job.assignments.find(
                  (assignment) => assignment.assignmentRole === AssignmentRole.STAFF,
                )?.user.name;
                const exceptions: Array<{ label: string; variant: "destructive" | "warning" }> = [];
                if (job.finalDepartment.code === "UNCLASSIFIED") {
                  exceptions.push({ label: "Unclassified", variant: "destructive" });
                }
                if (isOpenAssignmentExceptionJob(job) && !staff) {
                  exceptions.push({ label: "Missing staff", variant: "warning" });
                }
                if (isOpenAssignmentExceptionJob(job) && !supervisor) {
                  exceptions.push({ label: "Missing supervisor", variant: "warning" });
                }

                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.jobIdFromExcel}</TableCell>
                    <TableCell>
                      <div>{job.client.displayName}</div>
                      <div className="text-xs text-muted-foreground">{job.jobName}</div>
                    </TableCell>
                    <TableCell>{job.xpmState ?? job.jobStateNumber ?? "—"}</TableCell>
                    <TableCell>{job.finalDepartment.name}</TableCell>
                    <TableCell>{job.sourceManagerName?.trim() || <span className="text-destructive">Missing</span>}</TableCell>
                    <TableCell>{managers.length ? managers.join(", ") : "—"}</TableCell>
                    <TableCell>{supervisor ?? "—"}</TableCell>
                    <TableCell>{staff ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex min-w-40 flex-wrap gap-1">
                        {exceptions.map((exception) => (
                          <Badge key={exception.label} variant={exception.variant}>{exception.label}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/jobs/${job.id}`}>
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No job exceptions" description="No jobs match the selected exception report." />
      )}

      <Pagination
        basePath="/reports/exceptions"
        page={page}
        pageSize={pageSize}
        pageSizeOption={pageSizeOption}
        params={paginationParams}
        total={total}
      />
    </>
  );
}
