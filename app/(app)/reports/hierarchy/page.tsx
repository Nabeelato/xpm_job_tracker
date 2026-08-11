import { JobHierarchyGraphic, type HierarchyPerson } from "@/components/job-hierarchy-graphic";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { workflowStateWhere } from "@/lib/job-state";
import { reportScopeWhere, reportUserScopeWhere } from "@/lib/reports";
import { requireRole } from "@/lib/rbac";
import { getCurrentStatuses } from "@/lib/staff-status";

export default async function JobHierarchyReportPage() {
  const viewer = await requireRole(["ADMIN", "MANAGER", "SUPERVISOR"]);
  const userScope = reportUserScopeWhere(viewer);
  const scopedUsersWhere = viewer.role === "SUPERVISOR" && viewer.supervisorId
    ? { OR: [userScope, { id: viewer.supervisorId }] }
    : userScope;
  const users = await prisma.user.findMany({
    where: {
      active: true,
      AND: [scopedUsersWhere],
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      supervisorId: true,
      department: { select: { code: true } },
    },
  });
  const userIds = users.map((user) => user.id);
  const [assignments, currentStatuses] = await Promise.all([
    prisma.jobAssignment.findMany({
      where: {
        active: true,
        userId: { in: userIds },
        job: {
          archived: false,
          AND: [workflowStateWhere(), reportScopeWhere(viewer)],
        },
      },
      orderBy: { assignedAt: "desc" },
      select: {
        userId: true,
        assignedAt: true,
        job: {
          select: {
            id: true,
            jobIdFromExcel: true,
            jobName: true,
            jobStateNumber: true,
            client: { select: { displayName: true } },
          },
        },
      },
    }),
    getCurrentStatuses(userIds),
  ]);

  const assignmentsByUser = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const rows = assignmentsByUser.get(assignment.userId) ?? [];
    rows.push(assignment);
    assignmentsByUser.set(assignment.userId, rows);
  }
  const people: HierarchyPerson[] = users.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    departmentCode: person.department?.code ?? null,
    supervisorId: person.supervisorId,
    jobs: (assignmentsByUser.get(person.id) ?? []).map((assignment) => {
      const currentStatus = currentStatuses.get(person.id);
      return {
        id: assignment.job.id,
        jobIdFromExcel: assignment.job.jobIdFromExcel,
        jobName: assignment.job.jobName,
        clientName: assignment.job.client.displayName,
        stateNumber: assignment.job.jobStateNumber,
        assignedAt: assignment.assignedAt,
        workingSince: currentStatus?.jobId === assignment.job.id ? currentStatus.startedAt : null,
      };
    }),
  }));

  return (
    <>
      <PageHeader
        description="Graphic view of current workflow jobs by manager/admin, supervisor, and staff. Select a staff member to open their complete timeline."
        title="Current Jobs Hierarchy"
      />
      <JobHierarchyGraphic people={people} />
    </>
  );
}
