import Link from "next/link";
import type { ReactNode } from "react";
import { Download, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  bookkeepingByLabels,
  bookkeepingSoftwareLabels,
  clientCategories,
  clientCategoryLabels,
  jobStateOptions,
  userRoles,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { reportScopeWhere, reportUserScopeWhere } from "@/lib/reports";
import { requireRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function optionEntries(record: Record<string, string>): Option[] {
  return Object.entries(record).map(([value, label]) => ({ value, label }));
}

function ReportCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2" method="GET">
          {children}
          <button className={cn(buttonVariants(), "md:col-span-2")} type="submit">
            <Download className="h-4 w-4" />
            Download Excel
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default async function ReportsPage() {
  const user = await requireRole(["ADMIN"]);
  const reportWhere = reportScopeWhere(user);
  const userWhere = reportUserScopeWhere(user);
  const canExportImports = user.role === "ADMIN" || user.role === "MANAGER" || user.departmentCode === "QC";

  const [departments, departmentCounts, users, assignmentCounts, clientJobCounts] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.job.groupBy({
      by: ["finalDepartmentId"],
      where: reportWhere,
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { active: true, AND: [userWhere] },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.jobAssignment.groupBy({
      by: ["userId"],
      where: { active: true, job: reportWhere },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 12,
    }),
    prisma.job.groupBy({
      by: ["clientId"],
      where: reportWhere,
      _count: { clientId: true },
      orderBy: { _count: { clientId: "desc" } },
      take: 12,
    }),
  ]);

  const clientIds = clientJobCounts.map((client) => client.clientId);
  const clientRecords = clientIds.length
    ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, displayName: true } })
    : [];
  const clientsById = new Map(clientRecords.map((client) => [client.id, client.displayName]));
  const departmentCountById = new Map(departmentCounts.map((department) => [department.finalDepartmentId, department._count._all]));
  const assignmentCountByUserId = new Map(assignmentCounts.map((assignment) => [assignment.userId, assignment._count._all]));
  const userById = new Map(users.map((reportUser) => [reportUser.id, reportUser]));
  const supervisors = users.filter((reportUser) => reportUser.role === "SUPERVISOR");

  const userOptions = users.map((reportUser) => ({
    value: reportUser.id,
    label: reportUser.name ?? "Unnamed user",
  }));
  const supervisorOptions = supervisors.map((reportUser) => ({
    value: reportUser.id,
    label: reportUser.name ?? "Unnamed supervisor",
  }));
  const departmentOptions = departments.map((department) => ({ value: department.code, label: department.name }));
  const softwareOptions = optionEntries(bookkeepingSoftwareLabels);
  const bookkeepingByOptions = optionEntries(bookkeepingByLabels);

  return (
    <>
      <PageHeader
        description="Filter, preview, and export Excel reports using your allowed hierarchy scope."
        title="Report Center"
      />

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <ReportCard
          action="/api/reports/jobs/export"
          description="Detailed job list with client, category, state, department, assignment, source manager, and bookkeeping columns."
          title="Jobs Detail Report"
        >
          <Field label="Search">
            <Input name="q" placeholder="Job no, client, or job name" />
          </Field>
          <Field label="Department">
            <Select name="department">
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client Category">
            <Select name="clientCategory">
              <option value="">Any category</option>
              {clientCategories.map((category) => (
                <option key={category} value={category}>
                  {clientCategoryLabels[category]}
                </option>
              ))}
              <option value="uncategorized">Uncategorized</option>
            </Select>
          </Field>
          <Field label="Job State">
            <Select name="jobStateNumber">
              <option value="">Any job state</option>
              {jobStateOptions.map((state) => (
                <option key={state.code} value={state.number}>
                  {state.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned User">
            <Select name="assignedUserId">
              <option value="">Any assignee</option>
              <option value="unassigned">Unassigned</option>
              {userOptions.map((assignee) => (
                <option key={assignee.value} value={assignee.value}>
                  {assignee.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Missing Latest">
            <Select name="missing">
              <option value="">Any</option>
              <option value="true">Missing latest</option>
              <option value="false">Seen latest</option>
            </Select>
          </Field>
          <Field label="Archived">
            <Select name="archived" defaultValue="false">
              <option value="false">Active only</option>
              <option value="">Active and archived</option>
              <option value="true">Archived only</option>
            </Select>
          </Field>
          <Field label="Sort By">
            <Select name="sortBy">
              <option value="">Default</option>
              <option value="jobNo">Job No.</option>
              <option value="client">Client</option>
              <option value="jobName">Job Name</option>
              <option value="department">Department</option>
              <option value="state">State</option>
            </Select>
          </Field>
          <Field label="Sort Direction">
            <Select name="sortDir">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </Select>
          </Field>
        </ReportCard>

        <ReportCard
          action="/api/reports/clients/export"
          description="Client-level totals by department mix, category, bookkeeping software, active jobs, completed jobs, and missing jobs."
          title="Client Summary Report"
        >
          <Field label="Search">
            <Input name="q" placeholder="Client name" />
          </Field>
          <Field label="Client Filter">
            <Select name="filter">
              <option value="">All clients</option>
              <option value="multiple">Multiple jobs</option>
              <option value="missing">Missing jobs</option>
              <option value="vat">VAT jobs</option>
              <option value="software_bk">Software BK jobs</option>
              <option value="bk">BK jobs</option>
              <option value="afs">AFS jobs</option>
              <option value="all_3">All 3 departments</option>
              <option value="category_software">{clientCategoryLabels.SOFTWARE}</option>
              <option value="category_manual">{clientCategoryLabels.MANUAL}</option>
              <option value="category_uncategorized">Uncategorized</option>
            </Select>
          </Field>
          <Field label="Bookkeeping Software">
            <Select name="bookkeepingSoftware">
              <option value="">Any software</option>
              {softwareOptions.map((software) => (
                <option key={software.value} value={software.value}>
                  {software.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bookkeeping By">
            <Select name="bookkeepingBy">
              <option value="">Anyone</option>
              {bookkeepingByOptions.map((bookkeeper) => (
                <option key={bookkeeper.value} value={bookkeeper.value}>
                  {bookkeeper.label}
                </option>
              ))}
            </Select>
          </Field>
        </ReportCard>

        <ReportCard
          action="/api/reports/workload/export"
          description="User workload by hierarchy role, supervisor/team, department, workflow states, completed, cancelled, and missing jobs."
          title="User Workload Report"
        >
          <Field label="Department">
            <Select name="department">
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.value} value={department.value}>
                  {department.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="User Role">
            <Select name="role">
              <option value="">Any role</option>
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="User">
            <Select name="userId">
              <option value="">Any user</option>
              {userOptions.map((reportUser) => (
                <option key={reportUser.value} value={reportUser.value}>
                  {reportUser.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supervisor">
            <Select name="supervisorId">
              <option value="">Any supervisor</option>
              {supervisorOptions.map((supervisor) => (
                <option key={supervisor.value} value={supervisor.value}>
                  {supervisor.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status Group">
            <Select name="statusGroup">
              <option value="">All active-screen jobs</option>
              <option value="workflow">Workflow states 03-06</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="missing">Missing latest</option>
            </Select>
          </Field>
          <Field label="Specific State">
            <Select name="jobStateNumber">
              <option value="">Any job state</option>
              {jobStateOptions.map((state) => (
                <option key={state.code} value={state.number}>
                  {state.label}
                </option>
              ))}
            </Select>
          </Field>
        </ReportCard>

        <ReportCard
          action="/api/reports/assignments"
          description="Supervisor and staff assignment changes with date range, assignee search, and changed-by filtering."
          title="Assignment Change History"
        >
          <Field label="From">
            <Input name="from" type="date" />
          </Field>
          <Field label="To">
            <Input name="to" type="date" />
          </Field>
          <Field label="Role">
            <Select name="role">
              <option value="">Supervisor and staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="staff">Staff</option>
            </Select>
          </Field>
          <Field label="Name Search">
            <Input name="name" placeholder="Assigned from or to" />
          </Field>
          <Field label="Changed By">
            <Select name="changedById">
              <option value="">Anyone</option>
              {userOptions.map((reportUser) => (
                <option key={reportUser.value} value={reportUser.value}>
                  {reportUser.label}
                </option>
              ))}
            </Select>
          </Field>
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "self-end md:mt-5")}
            href="/reports/assignments"
          >
            <ExternalLink className="h-4 w-4" />
            Preview
          </Link>
        </ReportCard>

        {canExportImports ? (
          <ReportCard
            action="/api/reports/imports/export"
            description="Import batches, XPM file dates, row counts, state movement, missing jobs, completed/cancelled, and department totals."
            title="Import History Report"
          >
            <Field label="Uploaded From">
              <Input name="uploadedFrom" type="date" />
            </Field>
            <Field label="Uploaded To">
              <Input name="uploadedTo" type="date" />
            </Field>
            <Field label="XPM From">
              <Input name="xpmFrom" type="date" />
            </Field>
            <Field label="XPM To">
              <Input name="xpmTo" type="date" />
            </Field>
            <Field label="Status">
              <Select name="status">
                <option value="">Any status</option>
                <option value="STAGED">Staged</option>
                <option value="APPLIED">Applied</option>
                <option value="FAILED">Failed</option>
              </Select>
            </Field>
            <Field label="Uploaded By">
              <Select name="uploadedById">
                <option value="">Anyone</option>
                {userOptions.map((reportUser) => (
                  <option key={reportUser.value} value={reportUser.value}>
                    {reportUser.label}
                  </option>
                ))}
              </Select>
            </Field>
          </ReportCard>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Department</CardTitle>
            <CardDescription>Preview based on your report scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Jobs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell>{department.name}</TableCell>
                    <TableCell>{departmentCountById.get(department.id) ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workload Preview</CardTitle>
            <CardDescription>Top users by active assignments.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assignments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentCounts.map((assignment) => {
                  const reportUser = userById.get(assignment.userId);
                  return (
                    <TableRow key={assignment.userId}>
                      <TableCell>{reportUser?.name ?? "Unknown user"}</TableCell>
                      <TableCell>{reportUser?.role ?? "-"}</TableCell>
                      <TableCell>{assignmentCountByUserId.get(assignment.userId) ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clients</CardTitle>
            <CardDescription>Clients with the most scoped jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Jobs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientJobCounts.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell>{clientsById.get(client.clientId) ?? "Unknown client"}</TableCell>
                    <TableCell>{client._count.clientId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
