"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { stageImportBatch } from "@/lib/import/stage";
import { applyImportBatch } from "@/lib/import/apply";

function todayInputDate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function parseInputDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return { text, date: new Date(`${text}T00:00:00`) };
}

export async function stageImportAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const xpmDownloadedAt = parseInputDate(formData.get("xpmDownloadedAt"));
  if (!xpmDownloadedAt) redirect("/imports/upload?error=missing-download-date");

  const uploadDate = todayInputDate();
  if (xpmDownloadedAt.text < uploadDate) redirect("/imports/upload?error=download-date-past");
  if (xpmDownloadedAt.text > uploadDate) redirect("/imports/upload?error=download-date-future");

  const lastApplied = await prisma.importBatch.findFirst({
    where: { status: ImportStatus.APPLIED, xpmDownloadedAt: { not: null } },
    orderBy: { xpmDownloadedAt: "desc" },
    select: { xpmDownloadedAt: true },
  });
  if (lastApplied?.xpmDownloadedAt && xpmDownloadedAt.date <= lastApplied.xpmDownloadedAt) {
    redirect("/imports/upload?error=download-date-not-newer");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Upload file is required.");

  const batch = await stageImportBatch(file, user.id, xpmDownloadedAt.date);
  redirect(`/imports/${batch.id}/preview`);
}

export async function confirmImportAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) throw new Error("Import batch is required.");

  await applyImportBatch(batchId, user.id);
  revalidatePath("/");
  redirect(`/imports/${batchId}`);
}
