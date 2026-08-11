import { AssignmentRole, NotificationType, type Prisma } from "@prisma/client";

export type JobExceptionFilter = "all" | "unclassified" | "missing_staff" | "missing_supervisor";

export function isJobExceptionFilter(value: string | undefined): value is JobExceptionFilter {
  return value === "all" || value === "unclassified" || value === "missing_staff" || value === "missing_supervisor";
}

export function isOpenAssignmentExceptionJob(job: { archived: boolean; jobStateNumber: number | null }) {
  return !job.archived && job.jobStateNumber !== 11 && job.jobStateNumber !== 12;
}

export function openAssignmentExceptionWhere(): Prisma.JobWhereInput {
  return {
    archived: false,
    OR: [
      { jobStateNumber: null },
      { jobStateNumber: { notIn: [11, 12] } },
    ],
  };
}

export function missingAssignmentWhere(
  role: typeof AssignmentRole.STAFF | typeof AssignmentRole.SUPERVISOR,
): Prisma.JobWhereInput {
  return {
    AND: [
      openAssignmentExceptionWhere(),
      { assignments: { none: { active: true, assignmentRole: role, user: { active: true } } } },
    ],
  };
}

export function unclassifiedJobWhere(): Prisma.JobWhereInput {
  return {
    archived: false,
    finalDepartment: { code: "UNCLASSIFIED" },
  };
}

export function jobExceptionWhere(filter: JobExceptionFilter): Prisma.JobWhereInput {
  if (filter === "unclassified") return unclassifiedJobWhere();
  if (filter === "missing_staff") return missingAssignmentWhere(AssignmentRole.STAFF);
  if (filter === "missing_supervisor") return missingAssignmentWhere(AssignmentRole.SUPERVISOR);
  return {
    OR: [
      unclassifiedJobWhere(),
      missingAssignmentWhere(AssignmentRole.STAFF),
      missingAssignmentWhere(AssignmentRole.SUPERVISOR),
    ],
  };
}

const assignmentExceptionSummaries = [
  {
    type: NotificationType.MISSING_STAFF,
    role: AssignmentRole.STAFF,
    title: "Missing staff assignments",
    roleLabel: "staff",
    href: "/reports/exceptions?type=missing_staff",
  },
  {
    type: NotificationType.MISSING_SUPERVISOR,
    role: AssignmentRole.SUPERVISOR,
    title: "Missing supervisor assignments",
    roleLabel: "supervisor",
    href: "/reports/exceptions?type=missing_supervisor",
  },
] as const;

export async function syncMissingAssignmentExceptionNotifications(tx: Prisma.TransactionClient) {
  const adminIds = (
    await tx.user.findMany({
      where: { active: true, role: "ADMIN" },
      select: { id: true },
    })
  ).map((admin) => admin.id);
  if (!adminIds.length) return;

  const counts = new Map<NotificationType, number>();
  for (const summary of assignmentExceptionSummaries) {
    counts.set(summary.type, await tx.job.count({ where: missingAssignmentWhere(summary.role) }));
  }

  const existing = await tx.notification.findMany({
    where: {
      recipientId: { in: adminIds },
      type: { in: assignmentExceptionSummaries.map((summary) => summary.type) },
      jobId: null,
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, recipientId: true, type: true },
  });
  const now = new Date();

  for (const adminId of adminIds) {
    for (const summary of assignmentExceptionSummaries) {
      const count = counts.get(summary.type) ?? 0;
      const matching = existing.filter(
        (notification) => notification.recipientId === adminId && notification.type === summary.type,
      );

      if (count === 0) {
        if (matching.length) {
          await tx.notification.updateMany({
            where: { id: { in: matching.map((notification) => notification.id) } },
            data: { readAt: now },
          });
        }
        continue;
      }

      const body = `${count} active job${count === 1 ? "" : "s"} do${count === 1 ? "es" : ""} not have an active ${summary.roleLabel} assignment. Review the exception report now.`;
      if (matching[0]) {
        await tx.notification.update({
          where: { id: matching[0].id },
          data: { title: summary.title, body, href: summary.href, createdAt: now },
        });
        if (matching.length > 1) {
          await tx.notification.updateMany({
            where: { id: { in: matching.slice(1).map((notification) => notification.id) } },
            data: { readAt: now },
          });
        }
      } else {
        await tx.notification.create({
          data: {
            recipientId: adminId,
            type: summary.type,
            title: summary.title,
            body,
            href: summary.href,
          },
        });
      }
    }
  }
}
