import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignmentRoles } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireRole, visibleJobsWhere } from "@/lib/rbac";
import { titleCaseEnum } from "@/lib/utils";
import { assignJobAction } from "../jobs/actions";

export default async function AssignmentsPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const [jobs, users] = await Promise.all([
    prisma.job.findMany({
      where: { AND: [{ archived: false }, visibleJobsWhere(user)] },
      select: {
        id: true,
        jobIdFromExcel: true,
        client: { select: { displayName: true } },
        assignments: {
          where: { active: true },
          select: {
            assignmentRole: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: [{ internalStatus: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.user.findMany({
      where:
        user.role === "MANAGER"
          ? { active: true, departmentId: user.departmentId ?? "__none__", role: { in: ["SUPERVISOR", "STAFF"] } }
          : { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader action={{ href: "/assignments/bulk", label: "Bulk Assign" }} description="Assign primary, reviewer, supervisor, and helper roles without replacing existing assignments." title="Assignments" />
      <Card>
        <CardHeader>
          <CardTitle>Recent Active Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Current Assignments</TableHead>
                <TableHead>Assign</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    <Link className="text-primary hover:underline" href={`/jobs/${job.id}`}>
                      {job.jobIdFromExcel}
                    </Link>
                  </TableCell>
                  <TableCell>{job.client.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.assignments.length ? job.assignments.map((assignment) => `${assignment.user.name} (${titleCaseEnum(assignment.assignmentRole)})`).join(", ") : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <form action={assignJobAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <input name="jobId" type="hidden" value={job.id} />
                      <Select name="userId" required>
                        <option value="">User</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                      <Select name="assignmentRole">
                        {assignmentRoles.map((role) => (
                          <option key={role} value={role}>
                            {titleCaseEnum(role)}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" type="submit">
                        Assign
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
