import type { Prisma } from "@prisma/client";

export type JobStateGroup = "MAIN" | "OTHER" | "COMPLETED" | "CANCELLED";
export type XpmSubState = "ifza_check" | "job_on_hold";

const mainStateNumbers = new Set([2, 3, 4, 5, 6]);

export function parseJobStateNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})(?:\D|$)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return number >= 1 && number <= 12 ? number : null;
}

export function nextStateEnteredAt({
  previousStateNumber,
  nextStateNumber,
  previousStateEnteredAt,
  observedAt,
}: {
  previousStateNumber: number | null;
  nextStateNumber: number | null;
  previousStateEnteredAt: Date | null;
  observedAt: Date;
}) {
  if (previousStateNumber === nextStateNumber) return previousStateEnteredAt;
  return nextStateNumber === null ? null : observedAt;
}

export function nextJobLifecycleTimestamps({
  nextStateNumber,
  jobStartedAt,
  jobCompletedAt,
  observedAt,
}: {
  nextStateNumber: number | null;
  jobStartedAt: Date | null;
  jobCompletedAt: Date | null;
  observedAt: Date;
}) {
  return {
    jobStartedAt: jobStartedAt ?? (nextStateNumber === 3 ? observedAt : null),
    jobCompletedAt: jobCompletedAt ?? (nextStateNumber === 11 ? observedAt : null),
  };
}

export function isMainState(number: number | null | undefined) {
  return typeof number === "number" && mainStateNumbers.has(number);
}

export function stateGroupForNumber(number: number | null | undefined): JobStateGroup {
  if (number === 11) return "COMPLETED";
  if (number === 12) return "CANCELLED";
  if (isMainState(number)) return "MAIN";
  return "OTHER";
}

export function xpmSubStateWhere(sub: XpmSubState): Prisma.JobWhereInput {
  if (sub === "ifza_check") return { xpmState: { contains: "3.2" } };
  if (sub === "job_on_hold") return { xpmState: { contains: "3.1" } };
  return {};
}

export function workflowStateWhere(): Prisma.JobWhereInput {
  return {
    jobStateNumber: { in: [3, 4, 5, 6] },
    NOT: [
      { xpmState: { contains: "3.1" } },
      { xpmState: { contains: "3.2" } },
    ],
  };
}

export function exactStateWhere(number: number): Prisma.JobWhereInput {
  if (number !== 3) return { jobStateNumber: number };
  return {
    jobStateNumber: 3,
    NOT: [
      { xpmState: { contains: "3.1" } },
      { xpmState: { contains: "3.2" } },
    ],
  };
}

export function stateGroupWhere(group: JobStateGroup): Prisma.JobWhereInput {
  if (group === "MAIN") return { jobStateNumber: { in: [2, 3, 4, 5, 6] } };
  if (group === "COMPLETED") return { jobStateNumber: 11 };
  if (group === "CANCELLED") return { jobStateNumber: 12 };
  return {
    OR: [
      { jobStateNumber: null },
      { jobStateNumber: { in: [1, 7, 8, 9, 10] } },
    ],
  };
}
