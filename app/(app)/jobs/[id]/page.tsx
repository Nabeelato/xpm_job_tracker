import Link from "next/link";
import { Archive, UserPlus } from "lucide-react";
import { DepartmentBadge } from "@/components/department-badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JobComments } from "@/components/job-comments";
import { assignmentRoles, bookkeepingByLabels, bookkeepingSoftwareLabels, internalStatuses, userRoles } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { assertCanViewJob, canArchiveJobs, canAssignJobs, requireUser, visibleJobsWhere } from "@/lib/rbac";
import { formatDateTime, titleCaseEnum } from "@/lib/utils";
import { updateClientBookkeepingAction } from "@/app/(app)/clients/actions";
import {
  archiveJobAction,
  assignJobAction,
  deactivateAssignmentAction,
  updateDepartmentAction,
  updateInternalStatusAction,
} from "../actions";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, AND: [visibleJobsWhere(user)] },
    select: {
      id: true,
      jobIdFromExcel: true,
      clientId: true,
      jobName: true,
      priority: true,
      xpmState: true,
      jobStateNumber: true,
      stateEnteredAt: true,
      sourceManagerName: true,
      sourcePartnerName: true,
      finalDepartmentId: true,
      departmentManuallyOverridden: true,
      internalStatus: true,
      archived: true,
      missingFromLatestImport: true,
      lastSeenAt: true,
      client: { select: { displayName: true, bookkeepingSoftware: true, bookkeepingBy: true } },
      finalDepartment: { select: { code: true } },
      autoDetectedDepartment: { select: { code: true } },
      assignments: {
        where: { active: true },
        select: { id: true, userId: true, assignmentRole: true, assignmentSource: true, user: { select: { name: true } } },
        orderBy: { assignedAt: "desc" },
      },
      comments: {
        select: { id: true, comment: true, imageUrls: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      changeLogs: {
        select: {
          id: true,
          fieldName: true,
          oldValue: true,
          newValue: true,
          changeSource: true,
          changedAt: true,
          changedBy: { select: { name: true } },
        },
        orderBy: { changedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!job) return null;
  assertCanViewJob(user, {
    assignments: job.assignments.map((assignment) => ({
      userId: assignment.userId,
      assignmentRole: assignment.assignmentRole,
    })),
    finalDepartmentId: job.finalDepartmentId,
    jobStateNumber: job.jobStateNumber,
    archived: job.archived,
  });

  const [departments, users] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where:
        user.role === "MANAGER"
          ? { active: true, departmentId: user.departmentId ?? "__none__", role: { in: userRoles } }
          : { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);
  return (
    <>
      <PageHeader title={job.jobIdFromExcel} description={job.jobName} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Client</dt>
                  <dd className="font-medium">
                    <Link className="text-primary hover:underline" href={`/clients/${job.clientId}`}>
                      {job.client.displayName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>{job.priority ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source State</dt>
                  <dd>{job.xpmState ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Internal Status</dt>
                  <dd>
                    <StatusBadge value={job.internalStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="flex items-center gap-2">
                    <DepartmentBadge code={job.finalDepartment.code} />
                    {job.departmentManuallyOverridden ? <span className="text-xs text-muted-foreground">Manual override</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Auto Detected</dt>
                  <dd>
                    <DepartmentBadge code={job.autoDetectedDepartment?.code} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">State Entered</dt>
                  <dd>{formatDateTime(job.stateEnteredAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source Manager</dt>
                  <dd>{job.sourceManagerName ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source Partner</dt>
                  <dd>{job.sourcePartnerName ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Latest Source File</dt>
                  <dd>{formatDateTime(job.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Missing from Latest File</dt>
                  <dd>{job.missingFromLatestImport ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <JobComments comments={job.comments} jobId={job.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {job.changeLogs.length ? (
                  job.changeLogs.map((log) => (
                    <div className="grid gap-1 border-b pb-3 last:border-0" key={log.id}>
                      <div className="font-medium">{log.fieldName}</div>
                      <div className="text-muted-foreground">
                        {log.oldValue ?? "-"} -&gt; {log.newValue ?? "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.changeSource} | {log.changedBy?.name ?? "System"} | {formatDateTime(log.changedAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No changes logged yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateInternalStatusAction} className="space-y-3">
                <input name="jobId" type="hidden" value={job.id} />
                <Select defaultValue={job.internalStatus} name="internalStatus">
                  {internalStatuses.map((status) => (
                    <option key={status} value={status}>
                      {titleCaseEnum(status)}
                    </option>
                  ))}
                </Select>
                <Button type="submit">Save status</Button>
              </form>
            </CardContent>
          </Card>

          {canAssignJobs(user.role) ? (
            <Card>
              <CardHeader>
                <CardTitle>Assign Users</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={assignJobAction} className="space-y-3">
                  <input name="jobId" type="hidden" value={job.id} />
                  <Select name="userId" required>
                    <option value="">Select user</option>
                    {users.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.role})
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
                  <Button type="submit">
                    <UserPlus className="h-4 w-4" />
                    Assign
                  </Button>
                </form>
                <div className="space-y-2">
                  {job.assignments.length ? (
                    job.assignments.map((assignment) => (
                      <div className="flex items-center justify-between rounded-md border p-2 text-sm" key={assignment.id}>
                        <div>
                          <div className="font-medium">{assignment.user.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {titleCaseEnum(assignment.assignmentRole)} | {titleCaseEnum(assignment.assignmentSource)}
                          </div>
                        </div>
                        <form action={deactivateAssignmentAction}>
                          <input name="assignmentId" type="hidden" value={assignment.id} />
                          <Button size="sm" type="submit" variant="outline">
                            Remove
                          </Button>
                        </form>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No active assignments.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {canAssignJobs(user.role) ? (
            <Card>
              <CardHeader>
                <CardTitle>Department Correction</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateDepartmentAction} className="space-y-3">
                  <input name="jobId" type="hidden" value={job.id} />
                  <Select defaultValue={job.finalDepartmentId} name="departmentId">
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline">
                    Save department
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canAssignJobs(user.role) ? (
            <Card>
              <CardHeader>
                <CardTitle>Bookkeeping Software</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateClientBookkeepingAction} className="space-y-3">
                  <input name="clientId" type="hidden" value={job.clientId} />
                  <input name="fromJobId" type="hidden" value={job.id} />
                  <Select defaultValue={job.client.bookkeepingSoftware ?? ""} name="bookkeepingSoftware">
                    <option value="">None</option>
                    {(Object.keys(bookkeepingSoftwareLabels) as (keyof typeof bookkeepingSoftwareLabels)[]).map((key) => (
                      <option key={key} value={key}>
                        {bookkeepingSoftwareLabels[key]}
                      </option>
                    ))}
                  </Select>
                  <Select defaultValue={job.client.bookkeepingBy ?? ""} name="bookkeepingBy">
                    <option value="">Not set</option>
                    {(Object.keys(bookkeepingByLabels) as (keyof typeof bookkeepingByLabels)[]).map((key) => (
                      <option key={key} value={key}>
                        {bookkeepingByLabels[key]}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="outline">Save software</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canArchiveJobs(user.role) ? (
            <Card>
              <CardHeader>
                <CardTitle>Archive</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={archiveJobAction}>
                  <input name="jobId" type="hidden" value={job.id} />
                  <Button type="submit" variant="destructive">
                    <Archive className="h-4 w-4" />
                    Archive job
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
