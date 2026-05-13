"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function createUserAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;

  if (!name || !email || password.length < 8 || !Object.values(UserRole).includes(role)) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      departmentId,
      supervisorId,
    },
  });

  revalidatePath("/users");
}

export async function updateUserAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;
  const active = formData.get("active") === "on";
  if (!id || !Object.values(UserRole).includes(role)) return;

  await prisma.user.update({
    where: { id },
    data: { role, departmentId, supervisorId, active },
  });

  revalidatePath("/users");
}

export async function guardUsersPage() {
  const user = await requireRole(["ADMIN"]);
  if (user.role !== "ADMIN") redirect("/dashboard");
}
