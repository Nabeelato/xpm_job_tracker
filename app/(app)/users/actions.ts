"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function syncDefaultAssignee(
  userId: string,
  departmentId: string | null,
  shouldBeAssignee: boolean,
  userActive: boolean,
) {
  const wantActive = shouldBeAssignee && Boolean(departmentId) && userActive;

  await prisma.$transaction(async (tx) => {
    // Deactivate any other-department rows for this user (handles dept changes)
    await tx.departmentDefaultAssignee.updateMany({
      where: {
        userId,
        active: true,
        ...(departmentId ? { departmentId: { not: departmentId } } : {}),
      },
      data: { active: false },
    });

    if (!departmentId) return;

    if (wantActive) {
      await tx.departmentDefaultAssignee.upsert({
        where: { departmentId_userId: { departmentId, userId } },
        create: { departmentId, userId, active: true },
        update: { active: true },
      });
    } else {
      await tx.departmentDefaultAssignee.updateMany({
        where: { userId, departmentId, active: true },
        data: { active: false },
      });
    }
  });
}

export async function createUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;
  const autoAssign = formData.get("autoAssign") === "on";

  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!Object.values(UserRole).includes(role)) return { ok: false, error: "Invalid role." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, departmentId, supervisorId },
    select: { id: true },
  });

  if (autoAssign) {
    await syncDefaultAssignee(user.id, departmentId, true, true);
  }

  revalidatePath("/users");
  return { ok: true };
}

export async function updateUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;
  const active = formData.get("active") === "on";
  const autoAssign = formData.get("autoAssign") === "on";
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!id) return { ok: false, error: "Missing user id." };
  if (!Object.values(UserRole).includes(role)) return { ok: false, error: "Invalid role." };
  if (newPassword.length > 0 && newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const data: {
    role: UserRole;
    departmentId: string | null;
    supervisorId: string | null;
    active: boolean;
    passwordHash?: string;
  } = { role, departmentId, supervisorId, active };

  if (newPassword.length >= 8) {
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  await prisma.user.update({ where: { id }, data });
  await syncDefaultAssignee(id, departmentId, autoAssign, active);

  revalidatePath("/users");
  return { ok: true };
}

export async function deleteUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");

  if (!id) return { ok: false, error: "Missing user id." };
  if (id === admin.id) return { ok: false, error: "You cannot delete your own account." };

  const [assignments, assignedBy, comments, changeLogs, batches] = await prisma.$transaction([
    prisma.jobAssignment.count({ where: { userId: id } }),
    prisma.jobAssignment.count({ where: { assignedById: id } }),
    prisma.jobComment.count({ where: { userId: id } }),
    prisma.jobChangeLog.count({ where: { changedById: id } }),
    prisma.importBatch.count({ where: { uploadedById: id } }),
  ]);

  const refs: string[] = [];
  if (assignments > 0) refs.push(`${assignments} job assignment${assignments === 1 ? "" : "s"}`);
  if (assignedBy > 0) refs.push(`${assignedBy} assignment${assignedBy === 1 ? "" : "s"} made by user`);
  if (comments > 0) refs.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (changeLogs > 0) refs.push(`${changeLogs} change log${changeLogs === 1 ? "" : "s"}`);
  if (batches > 0) refs.push(`${batches} import batch${batches === 1 ? "" : "es"}`);

  if (refs.length > 0) {
    return {
      ok: false,
      error: `Cannot delete: user has ${refs.join(", ")}. Deactivate instead.`,
    };
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Unable to delete this user. They may have related records." };
  }

  revalidatePath("/users");
  return { ok: true };
}

export async function transferAssignmentsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
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
    const transferIds: string[] = [];
    for (const a of fromActive) {
      if (overlap.has(`${a.jobId}|${a.assignmentRole}`)) deactivateIds.push(a.id);
      else transferIds.push(a.id);
    }

    if (deactivateIds.length) {
      await tx.jobAssignment.updateMany({
        where: { id: { in: deactivateIds } },
        data: { active: false },
      });
      merged = deactivateIds.length;
    }
    if (transferIds.length) {
      await tx.jobAssignment.updateMany({
        where: { id: { in: transferIds } },
        data: { userId: toUserId },
      });
      transferred = transferIds.length;
    }

    if (deactivate) {
      await tx.user.update({ where: { id: fromUserId }, data: { active: false } });
      await tx.departmentDefaultAssignee.updateMany({
        where: { userId: fromUserId, active: true },
        data: { active: false },
      });
    }
  });

  revalidatePath("/users");

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
