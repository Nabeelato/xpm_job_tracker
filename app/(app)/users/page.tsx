import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export default async function UsersPage() {
  const currentUser = await requireRole(["ADMIN"]);
  const [users, departments, assignmentCounts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        supervisorId: true,
        active: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, name: true },
    }),
    prisma.jobAssignment.groupBy({
      by: ["userId"],
      where: { active: true },
      _count: { _all: true },
    }),
  ]);

  const countByUser = new Map(assignmentCounts.map((c) => [c.userId, c._count._all]));

  const supervisors = users.filter(
    (user) => user.role === "SUPERVISOR" || user.role === "MANAGER" || user.role === "ADMIN",
  );

  const transferTargets = users
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name }));

  const rows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    supervisorId: user.supervisorId,
    active: user.active,
    activeAssignmentCount: countByUser.get(user.id) ?? 0,
  }));

  return (
    <>
      <PageHeader description="Create users, assign roles, and map staff to supervisors." title="User Management" />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUserForm departments={departments} supervisors={supervisors} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <UserRow
                    currentUserId={currentUser.id}
                    departments={departments}
                    key={row.id}
                    supervisors={supervisors}
                    transferTargets={transferTargets}
                    user={row}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
