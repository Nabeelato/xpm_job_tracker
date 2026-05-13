import type { ImportBatch } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";

const metrics = [
  ["totalRows", "Total rows"],
  ["newJobsCount", "New jobs"],
  ["updatedJobsCount", "Updated jobs"],
  ["unchangedJobsCount", "Unchanged jobs"],
  ["newClientsCount", "New clients"],
  ["matchedClientsCount", "Matched clients"],
  ["missingJobsCount", "Missing jobs"],
  ["vatJobsCount", "VAT jobs 03-06"],
  ["softwareBkJobsCount", "Software BK jobs 03-06"],
  ["bkJobsCount", "BK jobs 03-06"],
  ["afsJobsCount", "AFS jobs 03-06"],
  ["unclassifiedJobsCount", "Unclassified jobs 03-06"],
  ["duplicateRowsCount", "Duplicate Job Nos"],
  ["errorRowsCount", "Error rows"],
  ["stateUpdatedCount", "State updated"],
  ["stateUnchangedCount", "State unchanged"],
  ["movedOutOfMainCount", "Moved out of Main"],
  ["completedStateCount", "Completed state"],
  ["cancelledStateCount", "Cancelled state"],
] as const satisfies ReadonlyArray<readonly [keyof ImportBatch, string]>;

type ImportSummaryBatch = Pick<ImportBatch, (typeof metrics)[number][0]>;

export function ImportSummaryCards({ batch }: { batch: ImportSummaryBatch }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {metrics.map(([key, label]) => (
        <Card key={String(key)}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{String(batch[key])}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
