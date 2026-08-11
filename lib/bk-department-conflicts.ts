import { NotificationType, type Prisma } from "@prisma/client";
import { isIrfanSourcePerson, isTaahaSourcePerson } from "@/lib/import/department";

export type BkDepartmentConflictJob = {
  finalDepartment: { code: string };
  sourcePartnerName: string | null;
};

export type BkDepartmentConflictReason = "mixed_departments" | "mixed_source_partners";

export function bkDepartmentConflictReasons(jobs: BkDepartmentConflictJob[]): BkDepartmentConflictReason[] {
  const departmentCodes = new Set(jobs.map((job) => job.finalDepartment.code));
  const reasons: BkDepartmentConflictReason[] = [];

  if (departmentCodes.has("BK") && departmentCodes.has("SOFTWARE_BK")) {
    reasons.push("mixed_departments");
  }

  const hasTaahaPartner = jobs.some((job) => isTaahaSourcePerson(job.sourcePartnerName));
  const hasIrfanPartner = jobs.some((job) => isIrfanSourcePerson(job.sourcePartnerName));
  if (hasTaahaPartner && hasIrfanPartner) {
    reasons.push("mixed_source_partners");
  }

  return reasons;
}

function conflictBody(clientName: string, reasons: BkDepartmentConflictReason[]) {
  const details: string[] = [];
  if (reasons.includes("mixed_departments")) {
    details.push("its active jobs are currently split between BK and Software BK");
  }
  if (reasons.includes("mixed_source_partners")) {
    details.push("its active jobs include both Taaha and Irfan as XPM source partners");
  }

  return `${clientName} needs a department confirmation because ${details.join(" and ")}. Please review the affected jobs and confirm whether each belongs in BK or Software BK.`;
}

function warningKey(recipientId: string, clientId: string) {
  return `${recipientId}:${clientId}`;
}

export async function syncBkDepartmentConflictNotifications(tx: Prisma.TransactionClient) {
  const [clients, recipients, existing] = await Promise.all([
    tx.client.findMany({
      where: { jobs: { some: { archived: false } } },
      select: {
        id: true,
        displayName: true,
        jobs: {
          where: { archived: false },
          select: {
            sourcePartnerName: true,
            finalDepartment: { select: { code: true } },
          },
        },
      },
    }),
    tx.user.findMany({
      where: { active: true },
      select: { id: true },
    }),
    tx.notification.findMany({
      where: {
        type: NotificationType.BK_DEPARTMENT_CONFLICT,
        clientId: { not: null },
        readAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, recipientId: true, clientId: true, title: true, body: true, href: true },
    }),
  ]);

  const conflicts = clients.flatMap((client) => {
    const reasons = bkDepartmentConflictReasons(client.jobs);
    return reasons.length ? [{ id: client.id, displayName: client.displayName, reasons }] : [];
  });
  const desiredKeys = new Set<string>();
  const existingByKey = new Map<string, typeof existing>();
  for (const notification of existing) {
    if (!notification.clientId) continue;
    const key = warningKey(notification.recipientId, notification.clientId);
    const matches = existingByKey.get(key) ?? [];
    matches.push(notification);
    existingByKey.set(key, matches);
  }

  const closeIds: string[] = [];
  const createData: Prisma.NotificationCreateManyInput[] = [];
  const title = "Confirm BK or Software BK department";

  for (const recipient of recipients) {
    for (const conflict of conflicts) {
      const key = warningKey(recipient.id, conflict.id);
      desiredKeys.add(key);
      const matching = existingByKey.get(key) ?? [];
      const body = conflictBody(conflict.displayName, conflict.reasons);
      const href = `/clients/${conflict.id}`;

      if (matching[0]) {
        if (matching[0].title !== title || matching[0].body !== body || matching[0].href !== href) {
          await tx.notification.update({
            where: { id: matching[0].id },
            data: { title, body, href },
          });
        }
        closeIds.push(...matching.slice(1).map((notification) => notification.id));
      } else {
        createData.push({
          recipientId: recipient.id,
          type: NotificationType.BK_DEPARTMENT_CONFLICT,
          title,
          body,
          href,
          clientId: conflict.id,
        });
      }
    }
  }

  for (const [key, notifications] of existingByKey) {
    if (!desiredKeys.has(key)) closeIds.push(...notifications.map((notification) => notification.id));
  }

  if (closeIds.length) {
    await tx.notification.updateMany({
      where: { id: { in: Array.from(new Set(closeIds)) } },
      data: { readAt: new Date() },
    });
  }
  if (createData.length) await tx.notification.createMany({ data: createData });

  return conflicts.length;
}
