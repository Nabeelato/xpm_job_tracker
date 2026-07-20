import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getCurrentStatuses } from "@/lib/staff-status";
import { formatDateTime, formatElapsedTime } from "@/lib/utils";

export default async function TeamStatusPage() {
  const user = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR"]);

  const where: Prisma.UserWhereInput =
    user.role === "SUPERVISOR" ? { active: true, supervisorId: user.id } : { active: true };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      department: { select: { code: true } },
    },
  });

  const statuses = await getCurrentStatuses(users.map((u) => u.id));

  const rows = users
    .map((u) => ({ user: u, status: statuses.get(u.id) ?? null }))
    .sort((a, b) => Number(Boolean(b.status)) - Number(Boolean(a.status)));
  const workingCount = rows.filter((row) => row.status).length;

  return (
    <>
      <PageHeader
        title="Staff Status"
        description={
          user.role === "SUPERVISOR"
            ? "What your team members are currently working on."
            : "What everyone is currently working on."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {workingCount} of {rows.length} working right now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Current Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ user: member, status }) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" href={`/team-status/${member.id}`}>
                        {member.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{member.role}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {member.department?.code ?? "—"}
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Link className="text-primary hover:underline" href={`/jobs/${status.job.id}`}>
                          {status.job.jobIdFromExcel} — {status.job.jobName}
                        </Link>
                      ) : (
                        <Badge variant="secondary">Idle</Badge>
                      )}
                    </TableCell>
                    <TableCell>{status ? status.job.client.displayName : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {status ? formatDateTime(status.startedAt) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {status ? formatElapsedTime(status.startedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
