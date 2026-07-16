"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatElapsedTime } from "@/lib/utils";

export function JobIdleTime({
  startedAt,
  completedAt,
}: {
  startedAt: Date | string | null;
  completedAt: Date | string | null;
}) {
  const [, setClockTick] = useState(0);

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const id = setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => clearInterval(id);
  }, [completedAt, startedAt]);

  if (!startedAt) return <>-</>;

  return (
    <time
      dateTime={typeof startedAt === "string" ? startedAt : startedAt.toISOString()}
      title={`Started ${formatDateTime(startedAt)}${completedAt ? `; completed ${formatDateTime(completedAt)}` : ""}`}
    >
      {completedAt ? "Completed" : "Running"} &middot;{" "}
      {formatElapsedTime(startedAt, completedAt ?? new Date())}
    </time>
  );
}
