"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { stageImportBatch } from "@/lib/import/stage";
import { applyImportBatch } from "@/lib/import/apply";

function parseInputDateTime(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  // datetime-local has no timezone; the user enters PKT (Asia/Karachi, UTC+5, no DST).
  // Parse explicitly with the +05:00 offset so the server doesn't treat it as UTC.
  const date = new Date(`${text}:00+05:00`);
  if (Number.isNaN(date.getTime())) return null;
  return { text, date };
}

export async function stageImportAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const xpmDownloadedAt = parseInputDateTime(formData.get("xpmDownloadedAt"));
  if (!xpmDownloadedAt) redirect("/imports/upload?error=missing-download-date");

  if (xpmDownloadedAt.date.getTime() > Date.now()) {
    redirect("/imports/upload?error=download-date-future");
  }

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
