import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userRoles } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { titleCaseEnum } from "@/lib/utils";
import { createUserAction, updateUserAction } from "./actions";

export default async function UsersPage() {
  await requireRole(["ADMIN"]);
  const users = await prisma.user.findMany({
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
  });
  const departments = await prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true } });
  const supervisors = users.filter((user) => user.role === "SUPERVISOR" || user.role === "MANAGER" || user.role === "ADMIN");

  return (
    <>
      <PageHeader description="Create users, assign roles, and map staff to supervisors." title="User Management" />
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createUserAction} className="space-y-3">
              <Input name="name" placeholder="Name" required />
              <Input name="email" placeholder="Email" required type="email" />
              <Input minLength={8} name="password" placeholder="Temporary password" required type="password" />
              <Select name="role" required>
                {userRoles.map((role) => (
                  <option key={role} value={role}>
                    {titleCaseEnum(role)}
                  </option>
                ))}
              </Select>
              <Select name="departmentId">
                <option value="">No department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
              <Select name="supervisorId">
                <option value="">No supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </Select>
              <Button type="submit">Create user</Button>
            </form>
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
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell colSpan={5}>
                      <form action={updateUserAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
                        <input name="id" type="hidden" value={user.id} />
                        <Select defaultValue={user.role} name="role">
                          {userRoles.map((role) => (
                            <option key={role} value={role}>
                              {titleCaseEnum(role)}
                            </option>
                          ))}
                        </Select>
                        <Select defaultValue={user.departmentId ?? ""} name="departmentId">
                          <option value="">No department</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </Select>
                        <Select defaultValue={user.supervisorId ?? ""} name="supervisorId">
                          <option value="">No supervisor</option>
                          {supervisors
                            .filter((supervisor) => supervisor.id !== user.id)
                            .map((supervisor) => (
                              <option key={supervisor.id} value={supervisor.id}>
                                {supervisor.name}
                              </option>
                            ))}
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                          <input defaultChecked={user.active} name="active" type="checkbox" />
                          Active
                        </label>
                        <Button size="sm" type="submit" variant="outline">
                          Save
                        </Button>
                      </form>
                    </TableCell>
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
