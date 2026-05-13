import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assignmentRoles } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { titleCaseEnum } from "@/lib/utils";
import { bulkAssignJobsAction } from "../../jobs/actions";

export default async function BulkAssignmentsPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const users = await prisma.user.findMany({
    where:
      user.role === "MANAGER"
        ? { active: true, departmentId: user.departmentId ?? "__none__", role: { in: ["SUPERVISOR", "STAFF"] } }
        : { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  return (
    <>
      <PageHeader description="Paste Job Nos separated by commas or new lines." title="Bulk Assign Jobs" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Bulk Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={bulkAssignJobsAction} className="space-y-4">
            <Textarea name="jobNumbers" placeholder="J000008&#10;J000014&#10;J001500" required />
            <Select name="userId" required>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </Select>
            <Select name="assignmentRole" required>
              {assignmentRoles.map((role) => (
                <option key={role} value={role}>
                  {titleCaseEnum(role)}
                </option>
              ))}
            </Select>
            <Button type="submit">Assign jobs</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
