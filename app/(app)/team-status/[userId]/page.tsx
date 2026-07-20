import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireUser, type AppSessionUser } from "@/lib/rbac";
import { getCurrentStatuses } from "@/lib/staff-status";
import { formatDateTime, formatElapsedTime, titleCaseEnum } from "@/lib/utils";

type TargetUser = { id: string; supervisorId: string | null };

function canViewStatusRecords(viewer: AppSessionUser, target: TargetUser) {
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") return true;
  if (target.supervisorId === viewer.id) return true;
  return target.id === viewer.id;
}

export default async function StaffStatusRecordsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const viewer = await requireUser();
  const { userId } = await params;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      supervisorId: true,
      department: { select: { code: true, name: true } },
    },
  });
  if (!target) notFound();
  if (!canViewStatusRecords(viewer, target)) redirect("/dashboard");

  const [statuses, sessions] = await Promise.all([
    getCurrentStatuses([target.id]),
    prisma.staffStatusSession.findMany({
      where: { userId: target.id },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        endReason: true,
        job: {
          select: {
            id: true,
            jobIdFromExcel: true,
            jobName: true,
            client: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);
  const currentStatus = statuses.get(target.id) ?? null;

  return (
    <>
      <PageHeader
        title={`${target.name} — Status Records`}
        description={`${titleCaseEnum(target.role)}${target.department ? ` · ${target.department.name}` : ""}`}
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStatus ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Working on</span>
              <Link className="font-medium text-primary hover:underline" href={`/jobs/${currentStatus.job.id}`}>
                {currentStatus.job.jobIdFromExcel} — {currentStatus.job.jobName}
              </Link>
              <span className="text-muted-foreground">
                ({currentStatus.job.client.displayName}) since {formatDateTime(currentStatus.startedAt)} ·{" "}
                {formatElapsedTime(currentStatus.startedAt)}
              </span>
            </div>
          ) : (
            <Badge variant="secondary">Idle</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            History{sessions.length === 200 ? " (showing latest 200)" : ` (${sessions.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job No.</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Ended Because</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" href={`/jobs/${session.job.id}`}>
                        {session.job.jobIdFromExcel}
                      </Link>
                    </TableCell>
                    <TableCell>{session.job.jobName}</TableCell>
                    <TableCell>{session.job.client.displayName}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(session.startedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {session.endedAt ? formatDateTime(session.endedAt) : <Badge variant="success">Ongoing</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatElapsedTime(session.startedAt, session.endedAt ?? new Date())}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {session.endReason ? titleCaseEnum(session.endReason) : "—"}
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
