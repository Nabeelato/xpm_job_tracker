import type { NotificationType, Prisma } from "@prisma/client";

export async function createNotification(
  prisma: Prisma.TransactionClient,
  data: {
    recipientId: string;
    actorId?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    href?: string | null;
    jobId?: string | null;
    diaryEntryId?: string | null;
  },
) {
  if (data.actorId && data.actorId === data.recipientId) return;
  await prisma.notification.create({ data });
}
