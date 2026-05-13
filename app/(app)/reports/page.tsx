import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/optimized-queries";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";

export default async function ReportsPage() {
  const user = await requireUser();
  const visibleWhere = visibleJobsWhere(user);

  const [departments, departmentCounts, users, assignmentCounts, clientJobCounts, metrics] = await Promise.all([
    prisma.department.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true } }),
    prisma.job.groupBy({
      by: ["finalDepartmentId"],
      where: visibleWhere,
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.jobAssignment.groupBy({
      by: ["userId"],
      where: { active: true, job: visibleWhere },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["clientId"],
      where: visibleWhere,
      _count: { clientId: true },
      orderBy: { _count: { clientId: "desc" } },
      take: 25,
    }),
    getDashboardMetrics(user),
  ]);

  const clientIds = clientJobCounts.map((client) => client.clientId);
  const clientRecords = clientIds.length
    ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, displayName: true } })
    : [];
  const clientsById = new Map(clientRecords.map((client) => [client.id, client]));
  const departmentCountById = new Map(departmentCounts.map((department) => [department.finalDepartmentId, department._count._all]));
  const assignmentCountByUserId = new Map(assignmentCounts.map((assignment) => [assignment.userId, assignment._count._all]));
  const topClients = clientJobCounts.map((client) => ({
    id: client.clientId,
    displayName: clientsById.get(client.clientId)?.displayName ?? "Unknown client",
    jobs: client._count.clientId,
  }));

  return (
    <>
      <PageHeader description="Operational reports from confirmed imports and current assignments." title="Reports" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Department</CardTitle>
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
            <CardTitle>Jobs by User</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Assignments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((assignee) => (
                  <TableRow key={assignee.id}>
                    <TableCell>{assignee.name}</TableCell>
                    <TableCell>{assignmentCountByUserId.get(assignee.id) ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs by Client</CardTitle>
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
                {topClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link className="text-primary hover:underline" href={`/clients/${client.id}`}>
                        {client.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{client.jobs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exception Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link className="flex justify-between rounded-md border p-3 hover:bg-muted/40" href="/clients/multiple">
              <span>Clients with multiple jobs</span>
              <span>{metrics.clientsWithMultipleJobs}</span>
            </Link>
            <Link className="flex justify-between rounded-md border p-3 hover:bg-muted/40" href="/jobs?assignedUserId=unassigned">
              <span>Unassigned jobs</span>
              <span>{metrics.unassignedJobs}</span>
            </Link>
            <Link className="flex justify-between rounded-md border p-3 hover:bg-muted/40" href="/jobs/missing">
              <span>Missing jobs</span>
              <span>{metrics.missingJobs}</span>
            </Link>
            <div className="flex justify-between rounded-md border p-3">
              <span>Completed jobs</span>
              <span>{metrics.completedJobs}</span>
            </div>
            <div className="flex justify-between rounded-md border p-3">
              <span>Cancelled jobs by Job State</span>
              <span>{metrics.cancelledJobs}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
