"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AssignmentRole, AssignmentSource, ChangeSource, InternalStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;

  if (!name) return { ok: false, error: "Name is required." };
  if (!username) return { ok: false, error: "Username is required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!Object.values(UserRole).includes(role)) return { ok: false, error: "Invalid role." };

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with this username already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, username, passwordHash, role, departmentId, supervisorId },
    select: { id: true },
  });

  revalidatePath("/users");
  return { ok: true };
}

export async function updateUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;
  const active = formData.get("active") === "on";
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!id) return { ok: false, error: "Missing user id." };
  if (!username) return { ok: false, error: "Username is required." };
  if (!Object.values(UserRole).includes(role)) return { ok: false, error: "Invalid role." };
  if (newPassword.length > 0 && newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const conflict = await prisma.user.findFirst({
    where: { username, NOT: { id } },
    select: { id: true },
  });
  if (conflict) return { ok: false, error: "That username is already taken by another user." };

  const data: {
    username: string;
    role: UserRole;
    departmentId: string | null;
    supervisorId: string | null;
    active: boolean;
    passwordHash?: string;
  } = {
    username,
    role,
    departmentId,
    supervisorId,
    active,
  };

  if (newPassword.length >= 8) {
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const targetAssignmentRole = role === UserRole.STAFF
    ? AssignmentRole.STAFF
    : role === UserRole.SUPERVISOR
      ? AssignmentRole.SUPERVISOR
      : AssignmentRole.MANAGER;
  let synchronizedAssignments = 0;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });

    const mismatchedAssignments = await tx.jobAssignment.findMany({
      where: {
        userId: id,
        active: true,
        assignmentRole: { not: targetAssignmentRole },
      },
      select: { id: true, jobId: true, assignmentRole: true },
    });
    if (!mismatchedAssignments.length) return;

    await tx.jobAssignment.updateMany({
      where: { id: { in: mismatchedAssignments.map((assignment) => assignment.id) } },
      data: { assignmentRole: targetAssignmentRole },
    });
    await tx.jobChangeLog.createMany({
      data: mismatchedAssignments.map((assignment) => ({
        jobId: assignment.jobId,
        changedById: admin.id,
        changeSource: ChangeSource.USER,
        fieldName: "assignment_role",
        oldValue: assignment.assignmentRole,
        newValue: targetAssignmentRole,
      })),
    });
    synchronizedAssignments = mismatchedAssignments.length;
  });

  revalidatePath("/users");
  revalidatePath("/jobs");
  revalidatePath("/jobs/my");
  return {
    ok: true,
    message: synchronizedAssignments
      ? `Saved. ${synchronizedAssignments} active job assignment${synchronizedAssignments === 1 ? "" : "s"} updated to ${targetAssignmentRole.toLowerCase()}.`
      : "Saved.",
  };
}

export async function deleteUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");

  if (!id) return { ok: false, error: "Missing user id." };
  if (id === admin.id) return { ok: false, error: "You cannot delete your own account." };

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  const [comments, batches] = await prisma.$transaction([
    prisma.jobComment.count({ where: { userId: id } }),
    prisma.importBatch.count({ where: { uploadedById: id } }),
  ]);

  const refs: string[] = [];
  if (comments > 0) refs.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (batches > 0) refs.push(`${batches} import batch${batches === 1 ? "" : "es"}`);

  if (refs.length > 0) {
    return {
      ok: false,
      error: `Cannot delete: user has ${refs.join(", ")}. Deactivate instead.`,
    };
  }

  let unassignedJobs = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const activeAssignments = await tx.jobAssignment.findMany({
        where: { userId: id, active: true },
        select: { jobId: true },
      });
      const affectedJobIds = Array.from(new Set(activeAssignments.map((assignment) => assignment.jobId)));

      await tx.jobAssignment.deleteMany({ where: { userId: id } });
      await tx.jobAssignment.updateMany({
        where: { assignedById: id },
        data: { assignedById: null },
      });
      await tx.jobChangeLog.updateMany({
        where: { changedById: id },
        data: { changedById: null },
      });
      await tx.notification.updateMany({
        where: { actorId: id },
        data: { actorId: null },
      });

      if (affectedJobIds.length > 0) {
        const jobsWithoutAssignments = await tx.job.findMany({
          where: {
            id: { in: affectedJobIds },
            archived: false,
            internalStatus: { notIn: [InternalStatus.UNASSIGNED, InternalStatus.ARCHIVED] },
            assignments: { none: { active: true } },
          },
          select: { id: true, internalStatus: true },
        });

        if (jobsWithoutAssignments.length > 0) {
          const jobIds = jobsWithoutAssignments.map((job) => job.id);
          await tx.job.updateMany({
            where: { id: { in: jobIds } },
            data: { internalStatus: InternalStatus.UNASSIGNED },
          });
          await tx.jobChangeLog.createMany({
            data: jobsWithoutAssignments.map((job) => ({
              jobId: job.id,
              changedById: admin.id,
              changeSource: ChangeSource.USER,
              fieldName: "internal_status",
              oldValue: job.internalStatus,
              newValue: InternalStatus.UNASSIGNED,
            })),
          });
          unassignedJobs = jobsWithoutAssignments.length;
        }
      }

      await tx.user.delete({ where: { id } });
    });
  } catch {
    return { ok: false, error: "Unable to delete this user. They may have related records." };
  }

  revalidatePath("/users");
  revalidatePath("/jobs");
  const suffix = unassignedJobs ? ` ${unassignedJobs} job${unassignedJobs === 1 ? "" : "s"} became unassigned.` : "";
  return { ok: true, message: `User deleted.${suffix}` };
}

export async function transferAssignmentsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(["ADMIN"]);
  const fromUserId = String(formData.get("fromUserId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  const deactivate = formData.get("deactivate") === "on";

  if (!fromUserId || !toUserId) {
    return { ok: false, error: "Both source and target users are required." };
  }
  if (fromUserId === toUserId) {
    return { ok: false, error: "Source and target must be different users." };
  }

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true } }),
    prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, active: true },
    }),
  ]);
  if (!fromUser) return { ok: false, error: "Source user not found." };
  if (!toUser) return { ok: false, error: "Target user not found." };
  if (!toUser.active) return { ok: false, error: "Target user is inactive. Activate them first." };

  let transferred = 0;
  let merged = 0;

  await prisma.$transaction(async (tx) => {
    const transferredAt = new Date();
    const fromActive = await tx.jobAssignment.findMany({
      where: { userId: fromUserId, active: true },
      select: { id: true, jobId: true, assignmentRole: true },
    });
    const toActive = await tx.jobAssignment.findMany({
      where: { userId: toUserId, active: true },
      select: { jobId: true, assignmentRole: true },
    });
    const overlap = new Set(toActive.map((a) => `${a.jobId}|${a.assignmentRole}`));

    const deactivateIds: string[] = [];
    const transferAssignments: typeof fromActive = [];
    for (const a of fromActive) {
      if (overlap.has(`${a.jobId}|${a.assignmentRole}`)) deactivateIds.push(a.id);
      else transferAssignments.push(a);
    }

    const allSourceAssignmentIds = [...deactivateIds, ...transferAssignments.map((assignment) => assignment.id)];
    if (allSourceAssignmentIds.length) {
      await tx.jobAssignment.updateMany({
        where: { id: { in: allSourceAssignmentIds } },
        data: { active: false },
      });
      merged = deactivateIds.length;
    }
    if (transferAssignments.length) {
      await tx.jobAssignment.createMany({
        data: transferAssignments.map((assignment) => ({
          jobId: assignment.jobId,
          userId: toUserId,
          assignmentRole: assignment.assignmentRole,
          assignmentSource: AssignmentSource.MANUAL,
          assignedById: admin.id,
          assignedAt: transferredAt,
        })),
      });
      transferred = transferAssignments.length;
    }

    if (deactivate) {
      await tx.user.update({ where: { id: fromUserId }, data: { active: false } });
    }
  });

  revalidatePath("/users");
  revalidatePath("/jobs", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  const parts: string[] = [];
  if (transferred) parts.push(`${transferred} transferred`);
  if (merged) parts.push(`${merged} already-assigned merged`);
  if (parts.length === 0) parts.push("No active assignments to transfer");
  const suffix = deactivate ? `, source user deactivated` : "";
  return { ok: true, message: `${parts.join(", ")}${suffix}.` };
}

export async function guardUsersPage() {
  const user = await requireRole(["ADMIN"]);
  if (user.role !== "ADMIN") redirect("/dashboard");
}
