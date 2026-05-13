"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { stageImportBatch } from "@/lib/import/stage";
import { applyImportBatch } from "@/lib/import/apply";

export async function stageImportAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Upload file is required.");

  const batch = await stageImportBatch(file, user.id);
  redirect(`/imports/${batch.id}/preview`);
}

export async function confirmImportAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) throw new Error("Import batch is required.");

  await applyImportBatch(batchId, user.id);
  revalidatePath("/");
  redirect(`/imports/${batchId}`);
}
