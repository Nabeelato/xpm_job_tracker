"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { managerUserRoles } from "@/lib/constants";
import { getSystemSetting, setSystemSetting } from "@/lib/settings";
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
  return user.role === "MANAGER" && Boolean(user.departmentId) && assignee.departmentId === user.departmentId;
}

function canAssignRoleTo(
  user: { role: string; departmentId?: string | null },
  assignee: { role: string; departmentId: string | null },
  assignmentRole: AssignmentRole,
) {
  if (user.role === "ADMIN") return true;
  if (!managerCanAssignTo(user, assignee)) return false;

  if (assignmentRole === AssignmentRole.MANAGER) {
    return managerUserRoles.includes(assignee.role as (typeof managerUserRoles)[number]);
  }

  if (assignmentRole === AssignmentRole.SUPERVISOR) {
    return assignee.role === "SUPERVISOR";
  }

  if (assignmentRole === AssignmentRole.STAFF) {
    return assignee.role === "STAFF";
  }

  return false;
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
    const imageUrls = formData.getAll("imageUrls").map(String).filter(Boolean);
    await tx.jobComment.create({
      data: {
        jobId: job.id,
        userId: user.id,
        comment,
        imageUrls,
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
  if (!canAssignRoleTo(user, assignee, assignmentRole)) redirect("/dashboard");

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

export async function claimJobAction(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId || !user.departmentId) return;

  const assignmentRole = user.role === "STAFF"
    ? AssignmentRole.STAFF
    : user.role === "SUPERVISOR"
      ? AssignmentRole.SUPERVISOR
      : AssignmentRole.MANAGER;

  await prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: {
        id: jobId,
        finalDepartmentId: user.departmentId!,
        jobStateNumber: { in: [3, 4, 5, 6] },
        archived: false,
        assignments: { none: { active: true } },
      },
      select: { id: true, internalStatus: true },
    });
    if (!job) return;

    await tx.jobAssignment.create({
      data: {
        jobId: job.id,
        userId: user.id,
        assignmentRole,
        assignmentSource: AssignmentSource.SELF_CLAIM,
        assignedById: user.id,
      },
    });
    if (job.internalStatus === InternalStatus.UNASSIGNED) {
      await tx.job.update({ where: { id: job.id }, data: { internalStatus: InternalStatus.ASSIGNED } });
    }
    await tx.jobChangeLog.create({
      data: {
        jobId: job.id,
        changedById: user.id,
        changeSource: ChangeSource.USER,
        fieldName: "self_claim",
        oldValue: null,
        newValue: assignmentRole,
      },
    });
  }, { isolationLevel: "Serializable" });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/jobs/my");
}

export async function toggleJobAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  const assigneeId = String(formData.get("userId") ?? "");
  const assignmentRole = String(formData.get("assignmentRole") ?? "") as AssignmentRole;
  const shouldAssign = String(formData.get("assigned") ?? "") === "true";
  if (!jobId || !assigneeId || !Object.values(AssignmentRole).includes(assignmentRole)) return;

  const [job, assignee] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: {
          where: { active: true },
          select: { id: true, userId: true, assignmentRole: true },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: assigneeId } }),
  ]);
  if (!job || !assignee?.active) return;

  const supervisorCanManage = user.role === "SUPERVISOR" &&
    assignmentRole === AssignmentRole.STAFF &&
    assignee.supervisorId === user.id &&
    job.assignments.some((assignment) =>
      assignment.assignmentRole === AssignmentRole.SUPERVISOR && assignment.userId === user.id,
    );
  const managerCanManage = (user.role === "ADMIN" || user.role === "MANAGER") &&
    managerCanManageJobAssignment(user, job) && canAssignRoleTo(user, assignee, assignmentRole);
  if (!supervisorCanManage && !managerCanManage) redirect("/dashboard");

  const existing = job.assignments.find((assignment) =>
    assignment.userId === assigneeId && assignment.assignmentRole === assignmentRole,
  );
  if (Boolean(existing) === shouldAssign) return;

  await prisma.$transaction(async (tx) => {
    if (shouldAssign) {
      await tx.jobAssignment.create({
        data: {
          jobId,
          userId: assigneeId,
          assignmentRole,
          assignmentSource: AssignmentSource.MANUAL,
          assignedById: user.id,
        },
      });
      await createNotification(tx, {
        recipientId: assigneeId,
        actorId: user.id,
        type: NotificationType.ASSIGNMENT_ADDED,
        title: "Job assigned",
        body: `${user.name ?? "A manager"} assigned ${job.jobIdFromExcel} to you as ${assignmentRole.toLowerCase()}.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      });
      if (job.internalStatus === InternalStatus.UNASSIGNED) {
        await tx.job.update({ where: { id: job.id }, data: { internalStatus: InternalStatus.ASSIGNED } });
      }
    } else if (existing) {
      await tx.jobAssignment.update({ where: { id: existing.id }, data: { active: false } });
      await createNotification(tx, {
        recipientId: assigneeId,
        actorId: user.id,
        type: NotificationType.ASSIGNMENT_REMOVED,
        title: "Assignment removed",
        body: `${user.name ?? "A manager"} removed your ${assignmentRole.toLowerCase()} assignment from ${job.jobIdFromExcel}.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      });
    }

    await tx.jobChangeLog.create({
      data: {
        jobId,
        changedById: user.id,
        changeSource: ChangeSource.USER,
        fieldName: `${assignmentRole.toLowerCase()}_assignment`,
        oldValue: shouldAssign ? null : assignee.name,
        newValue: shouldAssign ? assignee.name : null,
      },
    });
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/assignments");
}

export async function setJobRoleAssignmentAction(formData: FormData) {
  const user = await requireUser();

  const jobId = String(formData.get("jobId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const assignmentRole = String(formData.get("assignmentRole") ?? "") as AssignmentRole;
  if (!jobId || !Object.values(AssignmentRole).includes(assignmentRole)) return;

  const isManagerLevel = user.role === "ADMIN" || user.role === "MANAGER";
  const isSupervisorAssigningStaff = user.role === "SUPERVISOR" && assignmentRole === AssignmentRole.STAFF;
  if (!isManagerLevel && !isSupervisorAssigningStaff) redirect("/dashboard");

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assignments: { where: { active: true }, select: { id: true, userId: true, assignmentRole: true } } },
  });
  if (!job) return;

  if (user.role === "SUPERVISOR") {
    // Supervisor must be the assigned supervisor on this job
    const isSupOnJob = job.assignments.some(
      (a) => a.assignmentRole === AssignmentRole.SUPERVISOR && a.userId === user.id,
    );
    if (!isSupOnJob) redirect("/dashboard");
  } else {
    if (!managerCanManageJobAssignment(user, job)) redirect("/jobs/my");
  }

  const existingForRole = job.assignments.filter((a) => a.assignmentRole === assignmentRole);
  const alreadySet = userId && existingForRole.some((a) => a.userId === userId);
  if (alreadySet) return;

  // Fetch old assignee name for change log before transaction
  const isTrackedRole = assignmentRole === AssignmentRole.SUPERVISOR || assignmentRole === AssignmentRole.STAFF;
  let oldAssigneeName: string | null = null;
  if (isTrackedRole && existingForRole[0]) {
    const oldUser = await prisma.user.findUnique({ where: { id: existingForRole[0].userId }, select: { name: true } });
    oldAssigneeName = oldUser?.name ?? null;
  }

  let assignee = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  if (userId) {
    assignee = await prisma.user.findUnique({ where: { id: userId } });
    if (!assignee?.active) return;
    if (user.role === "SUPERVISOR") {
      // Supervisor can only assign their own direct reports
      if (assignee.supervisorId !== user.id) redirect("/dashboard");
    } else if (!canAssignRoleTo(user, assignee, assignmentRole)) {
      redirect("/dashboard");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (existingForRole.length) {
      await tx.jobAssignment.updateMany({
        where: { id: { in: existingForRole.map((a) => a.id) } },
        data: { active: false },
      });
      for (const prev of existingForRole) {
        await createNotification(tx, {
          recipientId: prev.userId,
          actorId: user.id,
          type: NotificationType.ASSIGNMENT_REMOVED,
          title: "Assignment removed",
          body: `${user.name ?? "A manager"} removed your ${assignmentRole.toLowerCase()} assignment from ${job.jobIdFromExcel}.`,
          href: `/jobs/${job.id}`,
          jobId: job.id,
        });
      }
    }

    // When supervisor changes, clear staff assignments — staff are scoped to their supervisor
    if (assignmentRole === AssignmentRole.SUPERVISOR) {
      const staffAssignments = job.assignments.filter((a) => a.assignmentRole === AssignmentRole.STAFF);
      if (staffAssignments.length) {
        await tx.jobAssignment.updateMany({
          where: { id: { in: staffAssignments.map((a) => a.id) } },
          data: { active: false },
        });
        for (const prev of staffAssignments) {
          await createNotification(tx, {
            recipientId: prev.userId,
            actorId: user.id,
            type: NotificationType.ASSIGNMENT_REMOVED,
            title: "Assignment removed",
            body: `${user.name ?? "A manager"} removed your staff assignment from ${job.jobIdFromExcel} due to a supervisor change.`,
            href: `/jobs/${job.id}`,
            jobId: job.id,
          });
        }
      }
    }

    if (userId && assignee) {
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
        body: `${user.name ?? "A manager"} assigned ${job.jobIdFromExcel} to you as ${assignmentRole.toLowerCase()}.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      });
    }

    if (userId && job.internalStatus === InternalStatus.UNASSIGNED) {
      await tx.job.update({
        where: { id: job.id },
        data: { internalStatus: InternalStatus.ASSIGNED },
      });
    }
  });

  if (isTrackedRole) {
    await logUserChange({
      job: { connect: { id: jobId } },
      changedBy: { connect: { id: user.id } },
      fieldName: assignmentRole === AssignmentRole.SUPERVISOR ? "supervisor_assignment" : "staff_assignment",
      oldValue: oldAssigneeName,
      newValue: assignee?.name ?? null,
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/assignments");
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
  if (!canAssignRoleTo(user, assignment.user, assignment.assignmentRole)) redirect("/dashboard");

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

// Bulk-assign Manager and/or Supervisor across many selected jobs at once.
// Sentinels in formData:
//   "managerUserId" / "supervisorUserId":
//     - omitted or "__skip__" → leave that role unchanged on each job
//     - "" (empty) → clear that role on each job
//     - <userId>   → set that role to this user on each job
export async function bulkAssignJobRolesAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const jobIds = String(formData.get("jobIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!jobIds.length) return;
  const operation = String(formData.get("operation") ?? "");
  const roleValue = String(formData.get("assignmentRole") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  if (!['ASSIGN', 'UNASSIGN'].includes(operation)) return;
  const role = roleValue === "ALL" ? null : roleValue as AssignmentRole;
  if (role && !Object.values(AssignmentRole).includes(role)) return;
  if (operation === "ASSIGN" && (!role || !targetUserId)) return;

  const targetUser = targetUserId
    ? await prisma.user.findUnique({ where: { id: targetUserId } })
    : null;
  if (operation === "ASSIGN") {
    if (!targetUser?.active || !role || !canAssignRoleTo(user, targetUser, role)) return;
  }

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    include: {
      assignments: { where: { active: true }, select: { id: true, userId: true, assignmentRole: true } },
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const job of jobs) {
      if (operation === "ASSIGN" && role && targetUser) {
        const alreadyAssigned = job.assignments.some((assignment) =>
          assignment.assignmentRole === role && assignment.userId === targetUser.id,
        );
        if (!alreadyAssigned) {
          await tx.jobAssignment.create({
            data: {
              jobId: job.id,
              userId: targetUser.id,
              assignmentRole: role,
              assignmentSource: AssignmentSource.MANUAL,
              assignedById: user.id,
            },
          });
          await createNotification(tx, {
            recipientId: targetUser.id,
            actorId: user.id,
            type: NotificationType.ASSIGNMENT_ADDED,
            title: "Job assigned",
            body: `${user.name ?? "An admin"} assigned ${job.jobIdFromExcel} to you as ${role.toLowerCase()}.`,
            href: `/jobs/${job.id}`,
            jobId: job.id,
          });
        }
        if (job.internalStatus === InternalStatus.UNASSIGNED) {
          await tx.job.update({ where: { id: job.id }, data: { internalStatus: InternalStatus.ASSIGNED } });
        }
        continue;
      }

      const removals = job.assignments.filter((assignment) =>
        (!role || assignment.assignmentRole === role) &&
        (!targetUserId || assignment.userId === targetUserId),
      );
      if (!removals.length) continue;
      await tx.jobAssignment.updateMany({
        where: { id: { in: removals.map((assignment) => assignment.id) } },
        data: { active: false },
      });
      for (const removal of removals) {
        await createNotification(tx, {
          recipientId: removal.userId,
          actorId: user.id,
          type: NotificationType.ASSIGNMENT_REMOVED,
          title: "Assignment removed",
          body: `${user.name ?? "An admin"} removed your assignment from ${job.jobIdFromExcel}.`,
          href: `/jobs/${job.id}`,
          jobId: job.id,
        });
      }
      if (removals.length === job.assignments.length && !job.archived) {
        await tx.job.update({
          where: { id: job.id },
          data: { internalStatus: InternalStatus.UNASSIGNED },
        });
      }
    }
  });

  revalidatePath("/jobs");
}

export async function toggleAssignmentAgeAction() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const current = await getSystemSetting("showAssignmentAge");
  await setSystemSetting("showAssignmentAge", current === "true" ? "false" : "true");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}
