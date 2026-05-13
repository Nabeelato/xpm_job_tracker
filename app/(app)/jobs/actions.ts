"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AssignmentRole,
  AssignmentSource,
  ChangeSource,
  InternalStatus,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import {
  assertCanViewJob,
  canArchiveJobs,
  canAssignJobs,
  requireUser,
  visibleJobsWhere,
} from "@/lib/rbac";

async function getVisibleJobOrRedirect(jobId: string) {
  const user = await requireUser();
  const job = await prisma.job.findFirst({
    where: { id: jobId, AND: [visibleJobsWhere(user)] },
    include: {
      assignments: {
        where: { active: true },
        select: { userId: true },
      },
    },
  });
  if (!job) redirect("/jobs/my");
  assertCanViewJob(user, job);
  return { user, job };
}

function managerCanAssignTo(user: { role: string; departmentId?: string | null }, assignee: { role: string; departmentId: string | null }) {
  if (user.role === "ADMIN") return true;
  return (
    user.role === "MANAGER" &&
    Boolean(user.departmentId) &&
    assignee.departmentId === user.departmentId &&
    (assignee.role === "SUPERVISOR" || assignee.role === "STAFF")
  );
}

function managerCanManageJobAssignment(user: { role: string; id: string }, job: { assignments: Array<{ userId: string }> }) {
  if (user.role === "ADMIN") return true;
  return user.role === "MANAGER" && job.assignments.some((assignment) => assignment.userId === user.id);
}

async function logUserChange(data: Omit<Prisma.JobChangeLogCreateInput, "changeSource">) {
  await prisma.jobChangeLog.create({
    data: {
      ...data,
      changeSource: ChangeSource.USER,
    },
  });
}

export async function updateInternalStatusAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("internalStatus") ?? "") as InternalStatus;
  if (!jobId || !Object.values(InternalStatus).includes(status)) return;

  const { user, job } = await getVisibleJobOrRedirect(jobId);
  if (job.internalStatus === status) return;

  await prisma.job.update({
    where: { id: job.id },
    data: { internalStatus: status },
  });
  await logUserChange({
    job: { connect: { id: job.id } },
    changedBy: { connect: { id: user.id } },
    fieldName: "internal_status",
    oldValue: job.internalStatus,
    newValue: status,
  });
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/jobs");
}

export async function updateDepartmentAction(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");

  const jobId = String(formData.get("jobId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!jobId || !departmentId) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, AND: [visibleJobsWhere(user)] } });
  if (!job || job.finalDepartmentId === departmentId) return;

  await prisma.job.update({
    where: { id: job.id },
    data: {
      finalDepartmentId: departmentId,
      departmentManuallyOverridden: true,
    },
  });
  await logUserChange({
    job: { connect: { id: job.id } },
    changedBy: { connect: { id: user.id } },
    fieldName: "final_department_id",
    oldValue: job.finalDepartmentId,
    newValue: departmentId,
  });
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/jobs");
}

export async function addCommentAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!jobId || !comment) return;

  const { user, job } = await getVisibleJobOrRedirect(jobId);
  await prisma.$transaction(async (tx) => {
    await tx.jobComment.create({
      data: {
        jobId: job.id,
        userId: user.id,
        comment,
      },
    });

    const assignments = await tx.jobAssignment.findMany({
      where: { jobId: job.id, active: true, userId: { not: user.id } },
      select: { userId: true },
      distinct: ["userId"],
    });

    for (const assignment of assignments) {
      await createNotification(tx, {
        recipientId: assignment.userId,
        actorId: user.id,
        type: NotificationType.COMMENT,
        title: "New job comment",
        body: `${user.name ?? "A user"} commented on ${job.jobIdFromExcel}.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      });
    }
  });
  revalidatePath(`/jobs/${job.id}`);
}

export async function archiveJobAction(formData: FormData) {
  const user = await requireUser();
  if (!canArchiveJobs(user.role)) redirect("/dashboard");

  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, AND: [visibleJobsWhere(user)] } });
  if (!job) return;

  await prisma.job.update({
    where: { id: job.id },
    data: { archived: true, internalStatus: InternalStatus.ARCHIVED },
  });
  await logUserChange({
    job: { connect: { id: job.id } },
    changedBy: { connect: { id: user.id } },
    fieldName: "archived",
    oldValue: String(job.archived),
    newValue: "true",
  });
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath("/jobs");
}

export async function assignJobAction(formData: FormData) {
  const user = await requireUser();
  if (!canAssignJobs(user.role)) redirect("/dashboard");

  const jobId = String(formData.get("jobId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const assignmentRole = String(formData.get("assignmentRole") ?? "") as AssignmentRole;
  if (!jobId || !userId || !Object.values(AssignmentRole).includes(assignmentRole)) return;

  const [job, assignee] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      include: { assignments: { where: { active: true }, select: { userId: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!job || !assignee?.active) return;
  if (!managerCanManageJobAssignment(user, job)) redirect("/jobs/my");
  if (!managerCanAssignTo(user, assignee)) redirect("/dashboard");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.jobAssignment.findFirst({
      where: { jobId, userId, assignmentRole, assignmentSource: AssignmentSource.MANUAL, active: true },
    });

    if (!existing) {
      await tx.jobAssignment.create({
        data: {
          jobId,
          userId,
          assignmentRole,
          assignmentSource: AssignmentSource.MANUAL,
          assignedById: user.id,
        },
      });
      await createNotification(tx, {
        recipientId: userId,
        actorId: user.id,
        type: NotificationType.ASSIGNMENT_ADDED,
        title: "Job assigned",
        body: `${user.name ?? "A manager"} assigned ${job.jobIdFromExcel} to you.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      });
    }

    if (job.internalStatus === InternalStatus.UNASSIGNED) {
      await tx.job.update({
        where: { id: job.id },
        data: { internalStatus: InternalStatus.ASSIGNED },
      });
      await tx.jobChangeLog.create({
        data: {
          jobId: job.id,
          changedById: user.id,
          changeSource: ChangeSource.USER,
          fieldName: "internal_status",
          oldValue: InternalStatus.UNASSIGNED,
          newValue: InternalStatus.ASSIGNED,
        },
      });
    }
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/assignments");
  revalidatePath("/jobs");
}

export async function deactivateAssignmentAction(formData: FormData) {
  const user = await requireUser();
  if (!canAssignJobs(user.role)) redirect("/dashboard");

  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) return;

  const assignment = await prisma.jobAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      user: true,
      job: {
        include: {
          assignments: { where: { active: true }, select: { userId: true } },
        },
      },
    },
  });
  if (!assignment || !assignment.active) return;
  if (!managerCanManageJobAssignment(user, assignment.job)) redirect("/jobs/my");
  if (!managerCanAssignTo(user, assignment.user)) redirect("/dashboard");

  await prisma.$transaction(async (tx) => {
    await tx.jobAssignment.update({
      where: { id: assignmentId },
      data: { active: false },
    });
    await createNotification(tx, {
      recipientId: assignment.userId,
      actorId: user.id,
      type: NotificationType.ASSIGNMENT_REMOVED,
      title: "Assignment removed",
      body: `${user.name ?? "A manager"} removed your assignment from ${assignment.job.jobIdFromExcel}.`,
      href: `/jobs/${assignment.jobId}`,
      jobId: assignment.jobId,
    });
  });
  await logUserChange({
    job: { connect: { id: assignment.jobId } },
    changedBy: { connect: { id: user.id } },
    fieldName: "assignment_active",
    oldValue: "true",
    newValue: "false",
  });
  revalidatePath(`/jobs/${assignment.jobId}`);
  revalidatePath("/assignments");
}

export async function bulkAssignJobsAction(formData: FormData) {
  const user = await requireUser();
  if (!canAssignJobs(user.role)) redirect("/dashboard");

  const jobNumbers = String(formData.get("jobNumbers") ?? "")
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
  const userId = String(formData.get("userId") ?? "");
  const assignmentRole = String(formData.get("assignmentRole") ?? "") as AssignmentRole;
  if (!jobNumbers.length || !userId || !Object.values(AssignmentRole).includes(assignmentRole)) return;

  const assignee = await prisma.user.findUnique({ where: { id: userId } });
  if (!assignee?.active) return;
  if (!managerCanAssignTo(user, assignee)) redirect("/dashboard");

  const jobs = await prisma.job.findMany({
    where: { AND: [{ jobIdFromExcel: { in: jobNumbers } }, visibleJobsWhere(user)] },
    include: { assignments: { where: { active: true }, select: { userId: true } } },
  });

  await prisma.$transaction(async (tx) => {
    for (const job of jobs) {
      if (!managerCanManageJobAssignment(user, job)) continue;
      const existing = await tx.jobAssignment.findFirst({
        where: { jobId: job.id, userId, assignmentRole, assignmentSource: AssignmentSource.MANUAL, active: true },
      });
      if (!existing) {
        await tx.jobAssignment.create({
          data: {
            jobId: job.id,
            userId,
            assignmentRole,
            assignmentSource: AssignmentSource.MANUAL,
            assignedById: user.id,
          },
        });
        await createNotification(tx, {
          recipientId: userId,
          actorId: user.id,
          type: NotificationType.ASSIGNMENT_ADDED,
          title: "Job assigned",
          body: `${user.name ?? "A manager"} assigned ${job.jobIdFromExcel} to you.`,
          href: `/jobs/${job.id}`,
          jobId: job.id,
        });
      }
      if (job.internalStatus === InternalStatus.UNASSIGNED) {
        await tx.job.update({
          where: { id: job.id },
          data: { internalStatus: InternalStatus.ASSIGNED },
        });
      }
    }
  });

  revalidatePath("/assignments");
  revalidatePath("/jobs");
}
