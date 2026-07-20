"use server";

import { revalidatePath } from "next/cache";
import { Prisma, StaffStatusEndReason } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workflowStateWhere } from "@/lib/job-state";
import { requireUser } from "@/lib/rbac";

function revalidateStatusViews() {
  revalidatePath("/", "layout");
}

export async function setStatusAction(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      archived: false,
      ...workflowStateWhere(),
      assignments: { some: { userId: user.id, active: true } },
    },
    select: { id: true },
  });
  if (!job) return;

  const openSession = await prisma.staffStatusSession.findFirst({
    where: { userId: user.id, endedAt: null },
    select: { id: true, jobId: true },
  });
  if (openSession?.jobId === job.id) return;

  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.staffStatusSession.updateMany({
        where: { userId: user.id, endedAt: null },
        data: { endedAt: now, endReason: StaffStatusEndReason.USER_SWITCHED },
      }),
      prisma.staffStatusSession.create({
        data: { userId: user.id, jobId: job.id, startedAt: now },
      }),
    ]);
  } catch (error) {
    // Partial unique index: another tab opened a session concurrently — let it win.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }

  revalidateStatusViews();
}

export async function clearStatusAction() {
  const user = await requireUser();

  const result = await prisma.staffStatusSession.updateMany({
    where: { userId: user.id, endedAt: null },
    data: { endedAt: new Date(), endReason: StaffStatusEndReason.USER_CLEARED },
  });
  if (result.count === 0) return;

  revalidateStatusViews();
}
