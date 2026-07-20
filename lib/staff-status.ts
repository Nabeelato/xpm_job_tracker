import { StaffStatusEndReason } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workflowStateWhere } from "@/lib/job-state";

export type CurrentStatus = {
  sessionId: string;
  jobId: string;
  startedAt: Date;
  job: {
    id: string;
    jobName: string;
    jobIdFromExcel: string;
    client: { displayName: string };
  };
};

export type EligibleJob = {
  id: string;
  jobName: string;
  jobIdFromExcel: string;
  client: { displayName: string };
};

type OpenSession = {
  id: string;
  userId: string;
  jobId: string;
  startedAt: Date;
  job: {
    id: string;
    jobName: string;
    jobIdFromExcel: string;
    jobStateNumber: number | null;
    xpmState: string | null;
    archived: boolean;
    client: { displayName: string };
    assignments: Array<{ userId: string }>;
  };
};

function isActiveWorkflowJob(job: OpenSession["job"]) {
  if (job.archived) return false;
  if (job.jobStateNumber === null || ![3, 4, 5, 6].includes(job.jobStateNumber)) return false;
  if (job.xpmState?.includes("3.1") || job.xpmState?.includes("3.2")) return false;
  return true;
}

export function staleEndReason(session: OpenSession): StaffStatusEndReason | null {
  if (!isActiveWorkflowJob(session.job)) return StaffStatusEndReason.JOB_LEFT_WORKFLOW;
  if (!session.job.assignments.some((a) => a.userId === session.userId)) {
    return StaffStatusEndReason.ASSIGNMENT_ENDED;
  }
  return null;
}

export async function getCurrentStatuses(userIds: string[]): Promise<Map<string, CurrentStatus>> {
  if (userIds.length === 0) return new Map();

  const openSessions: OpenSession[] = await prisma.staffStatusSession.findMany({
    where: { userId: { in: userIds }, endedAt: null },
    select: {
      id: true,
      userId: true,
      jobId: true,
      startedAt: true,
      job: {
        select: {
          id: true,
          jobName: true,
          jobIdFromExcel: true,
          jobStateNumber: true,
          xpmState: true,
          archived: true,
          client: { select: { displayName: true } },
          assignments: { where: { active: true }, select: { userId: true } },
        },
      },
    },
  });

  const staleByReason = new Map<StaffStatusEndReason, string[]>();
  const current = new Map<string, CurrentStatus>();

  for (const session of openSessions) {
    const reason = staleEndReason(session);
    if (reason) {
      const ids = staleByReason.get(reason) ?? [];
      ids.push(session.id);
      staleByReason.set(reason, ids);
    } else {
      current.set(session.userId, {
        sessionId: session.id,
        jobId: session.jobId,
        startedAt: session.startedAt,
        job: {
          id: session.job.id,
          jobName: session.job.jobName,
          jobIdFromExcel: session.job.jobIdFromExcel,
          client: session.job.client,
        },
      });
    }
  }

  if (staleByReason.size > 0) {
    const now = new Date();
    for (const [endReason, ids] of staleByReason) {
      await prisma.staffStatusSession.updateMany({
        where: { id: { in: ids }, endedAt: null },
        data: { endedAt: now, endReason },
      });
    }
  }

  return current;
}

export async function getCurrentStatus(userId: string): Promise<CurrentStatus | null> {
  const statuses = await getCurrentStatuses([userId]);
  return statuses.get(userId) ?? null;
}

export async function eligibleJobsFor(userId: string): Promise<EligibleJob[]> {
  return prisma.job.findMany({
    where: {
      archived: false,
      ...workflowStateWhere(),
      assignments: { some: { userId, active: true } },
    },
    orderBy: { jobName: "asc" },
    select: {
      id: true,
      jobName: true,
      jobIdFromExcel: true,
      client: { select: { displayName: true } },
    },
  });
}

export function statusJobLabel(job: { jobName: string; client: { displayName: string } }) {
  return `${job.client.displayName} — ${job.jobName}`;
}
