"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClientCategory } from "@prisma/client";
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
