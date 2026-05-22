import type { Prisma } from "@prisma/client";

export type JobStateGroup = "MAIN" | "OTHER" | "COMPLETED" | "CANCELLED";

const mainStateNumbers = new Set([2, 3, 4, 5, 6]);

export function parseJobStateNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})(?:\D|$)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return number >= 1 && number <= 12 ? number : null;
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
