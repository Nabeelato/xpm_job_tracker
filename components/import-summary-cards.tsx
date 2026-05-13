import type { ImportBatch } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";

type ImportSummaryBatch = Pick<
  ImportBatch,
  "stateUpdatedCount" | "newJobsCount" | "missingJobsCount" | "completedStateCount" | "cancelledStateCount"
>;

export function ImportSummaryCards({ batch }: { batch: ImportSummaryBatch }) {
  const metrics = [
    ["State updated", batch.stateUpdatedCount],
    ["New jobs added", batch.newJobsCount],
    ["Missing from import", batch.missingJobsCount],
    ["Moved to completed/cancelled", batch.completedStateCount + batch.cancelledStateCount],
  ] as const;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
