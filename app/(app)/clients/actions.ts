"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookkeepingBy, BookkeepingSoftware, ClientCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

export async function updateClientCategoryAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const clientId = String(formData.get("clientId") ?? "");
  const raw = String(formData.get("category") ?? "");
  if (!clientId) return;

  const category =
    raw === "" ? null : Object.values(ClientCategory).includes(raw as ClientCategory) ? (raw as ClientCategory) : null;

  await prisma.client.update({
    where: { id: clientId },
    data: { category },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function updateClientBookkeepingAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const rawSoftware = String(formData.get("bookkeepingSoftware") ?? "");
  const rawBy = String(formData.get("bookkeepingBy") ?? "");

  const bookkeepingSoftware =
    rawSoftware === ""
      ? null
      : Object.values(BookkeepingSoftware).includes(rawSoftware as BookkeepingSoftware)
        ? (rawSoftware as BookkeepingSoftware)
        : null;

  const bookkeepingBy =
    rawBy === ""
      ? null
      : Object.values(BookkeepingBy).includes(rawBy as BookkeepingBy)
        ? (rawBy as BookkeepingBy)
        : null;

  const fromJobId = String(formData.get("fromJobId") ?? "");

  await prisma.client.update({
    where: { id: clientId },
    data: { bookkeepingSoftware, bookkeepingBy },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/jobs");
  if (fromJobId) revalidatePath(`/jobs/${fromJobId}`);
}
