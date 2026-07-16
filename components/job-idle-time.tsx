"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatElapsedMilliseconds } from "@/lib/utils";

export function JobStateIdleTime({
  stateNumber,
  accumulatedMs,
  activeEnteredAt,
}: {
  stateNumber: number | null;
  accumulatedMs: number;
  activeEnteredAt: Date | string | null;
}) {
  const [, setClockTick] = useState(0);

  useEffect(() => {
    if (!activeEnteredAt) return;
    const id = setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => clearInterval(id);
  }, [activeEnteredAt]);

  if (stateNumber === null || stateNumber < 1 || stateNumber > 6) return <>-</>;
  const enteredAt = activeEnteredAt
    ? typeof activeEnteredAt === "string" ? new Date(activeEnteredAt) : activeEnteredAt
    : null;
  const elapsedMs = accumulatedMs + (enteredAt ? Math.max(0, Date.now() - enteredAt.getTime()) : 0);
  const title = enteredAt
    ? `Current state ${stateNumber} visit started ${formatDateTime(enteredAt)}; previous accumulated time ${formatElapsedMilliseconds(accumulatedMs)}`
    : `Recorded time in state ${stateNumber}`;

  return (
    <span title={title}>
      State {stateNumber} &middot; {formatElapsedMilliseconds(elapsedMs)}
    </span>
  );
}
