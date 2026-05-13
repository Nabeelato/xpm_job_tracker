"use server";

import { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { canWriteDiary, requireUser } from "@/lib/rbac";

export async function createDiaryEntryAction(formData: FormData) {
  const user = await requireUser();
  if (!canWriteDiary(user)) redirect("/dashboard");

  const recipientId = String(formData.get("recipientId") ?? "");
  const entry = String(formData.get("entry") ?? "").trim();
  if (!recipientId || !entry) return;

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient?.active) return;

  await prisma.$transaction(async (tx) => {
    const diaryEntry = await tx.diaryEntry.create({
      data: {
        recipientId,
        authorId: user.id,
        entry,
      },
    });
    await createNotification(tx, {
      recipientId,
      actorId: user.id,
      type: NotificationType.DIARY_ENTRY,
      title: "Diary entry added",
      body: `${user.name ?? "A manager"} wrote a diary entry for you.`,
      href: "/diary",
      diaryEntryId: diaryEntry.id,
    });
  });

  revalidatePath("/diary");
}
