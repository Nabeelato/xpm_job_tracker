import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireUser, type AppSessionUser } from "@/lib/rbac";
import { getCurrentStatuses } from "@/lib/staff-status";
import { formatDateTime, formatElapsedMilliseconds, formatElapsedTime, titleCaseEnum } from "@/lib/utils";

type TargetUser = { id: string; supervisorId: string | null; departmentId: string | null };

function canViewStatusRecords(viewer: AppSessionUser, target: TargetUser) {
  if (viewer.role === "ADMIN" || viewer.departmentCode === "QC") return true;
  if (viewer.role === "MANAGER") return Boolean(viewer.departmentId) && viewer.departmentId === target.departmentId;
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
      departmentId: true,
      supervisorId: true,
      department: { select: { code: true, name: true } },
    },
  });
  if (!target) notFound();
  if (!canViewStatusRecords(viewer, target)) redirect("/dashboard");

  const [statuses, sessions, assignments] = await Promise.all([
    getCurrentStatuses([target.id]),
    prisma.staffStatusSession.findMany({
      where: { userId: target.id },
      orderBy: { startedAt: "desc" },
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
    prisma.jobAssignment.findMany({
      where: { userId: target.id },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        assignmentRole: true,
        assignedAt: true,
        active: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            jobIdFromExcel: true,
            jobName: true,
            jobStateNumber: true,
            client: { select: { displayName: true } },
            stateTimeRecords: {
              orderBy: { enteredAt: "asc" },
              select: { id: true, stateNumber: true, enteredAt: true, exitedAt: true },
            },
            staffStatusSessions: {
              where: { userId: target.id },
              orderBy: { startedAt: "asc" },
              select: { id: true, startedAt: true, endedAt: true, endReason: true },
            },
          },
        },
      },
    }),
  ]);
  const currentStatus = statuses.get(target.id) ?? null;
  const now = new Date();

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

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Assignment and Job State Timeline ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No job assignment timeline is available yet.</p>
          ) : assignments.map((assignment) => {
            const assignmentEnd = assignment.active ? now : assignment.updatedAt;
            const stateDurationMs = assignment.job.stateTimeRecords.reduce((total, record) => (
              total + Math.max(0, (record.exitedAt ?? now).getTime() - record.enteredAt.getTime())
            ), 0);
            return (
              <details className="rounded-lg border bg-white open:border-primary/30" key={assignment.id}>
                <summary className="cursor-pointer list-none p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link className="font-semibold text-primary hover:underline" href={`/jobs/${assignment.job.id}`}>
                        {assignment.job.jobIdFromExcel} — {assignment.job.jobName}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {assignment.job.client.displayName} · Current state {assignment.job.jobStateNumber ?? "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{titleCaseEnum(assignment.assignmentRole)}</Badge>
                      <Badge variant={assignment.active ? "success" : "secondary"}>{assignment.active ? "Active" : "Ended"}</Badge>
                      <span>Assigned {formatDateTime(assignment.assignedAt)}</span>
                      <span className="font-medium">Duration {formatElapsedTime(assignment.assignedAt, assignmentEnd)}</span>
                    </div>
                  </div>
                </summary>
                <div className="border-t p-4">
                  <div className="mb-2 text-sm font-semibold">
                    State movements · recorded duration {formatElapsedMilliseconds(stateDurationMs)}
                  </div>
                  {assignment.job.stateTimeRecords.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>State</TableHead>
                            <TableHead>Entered</TableHead>
                            <TableHead>Exited</TableHead>
                            <TableHead>Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignment.job.stateTimeRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">State {record.stateNumber}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs">{formatDateTime(record.enteredAt)}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs">
                                {record.exitedAt ? formatDateTime(record.exitedAt) : <Badge variant="success">Current</Badge>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatElapsedTime(record.enteredAt, record.exitedAt ?? now)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No state movements have been recorded for this job.</p>}

                  <div className="mb-2 mt-4 text-sm font-semibold">Staff working sessions</div>
                  {assignment.job.staffStatusSessions.length ? (
                    <div className="space-y-1 text-xs">
                      {assignment.job.staffStatusSessions.map((session) => (
                        <div className="flex flex-wrap gap-2 rounded bg-muted/40 px-3 py-2" key={session.id}>
                          <span>{formatDateTime(session.startedAt)}</span>
                          <span>→</span>
                          <span>{session.endedAt ? formatDateTime(session.endedAt) : "Ongoing"}</span>
                          <span className="font-medium">({formatElapsedTime(session.startedAt, session.endedAt ?? now)})</span>
                          <span className="text-muted-foreground">{session.endReason ? titleCaseEnum(session.endReason) : ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No working sessions recorded for this job.</p>}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Working Session History ({sessions.length})
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
