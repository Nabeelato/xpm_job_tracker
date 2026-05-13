import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ImportResultRow = {
  id: string;
  rowNumber: number;
  action: string;
  detectedJobId: string | null;
  detectedClientName: string | null;
  detectedJobName: string | null;
  previousXpmState: string | null;
  newXpmState: string | null;
  previousStateNumber: number | null;
  newStateNumber: number | null;
  stateComparisonCategory: string;
};

function stateText(sourceState: string | null, stateNumber: number | null) {
  if (sourceState) return sourceState;
  if (stateNumber) return `State ${stateNumber}`;
  return "-";
}

function orderRows(rows: ImportResultRow[]) {
  return [...rows].sort((a, b) => {
    const clientSort = (a.detectedClientName ?? "").localeCompare(b.detectedClientName ?? "");
    if (clientSort !== 0) return clientSort;
    return (a.detectedJobId ?? "").localeCompare(b.detectedJobId ?? "");
  });
}

function ResultTable({
  rows,
  emptyText,
  showPreviousState = true,
}: {
  rows: ImportResultRow[];
  emptyText: string;
  showPreviousState?: boolean;
}) {
  const orderedRows = orderRows(rows).slice(0, 100);

  if (!orderedRows.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Job No.</TableHead>
          <TableHead>Job Name</TableHead>
          {showPreviousState ? <TableHead>Previous State</TableHead> : null}
          <TableHead>New State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderedRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.detectedClientName ?? "-"}</TableCell>
            <TableCell>{row.detectedJobId ?? "-"}</TableCell>
            <TableCell className="max-w-md">{row.detectedJobName ?? "-"}</TableCell>
            {showPreviousState ? <TableCell>{stateText(row.previousXpmState, row.previousStateNumber)}</TableCell> : null}
            <TableCell>{stateText(row.newXpmState, row.newStateNumber)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ResultSection({
  title,
  rows,
  emptyText,
  showPreviousState = true,
}: {
  title: string;
  rows: ImportResultRow[];
  emptyText: string;
  showPreviousState?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">{rows.length}</Badge>
      </CardHeader>
      <CardContent>
        <ResultTable emptyText={emptyText} rows={rows} showPreviousState={showPreviousState} />
        {rows.length > 100 ? <p className="mt-3 text-xs text-muted-foreground">Showing first 100 rows.</p> : null}
      </CardContent>
    </Card>
  );
}

export function ImportResultSections({ rows }: { rows: ImportResultRow[] }) {
  const stateUpdatedRows = rows.filter((row) => row.stateComparisonCategory === "STATE_UPDATED");
  const newJobRows = rows.filter((row) => row.action === "NEW_JOB");
  const missingRows = rows.filter((row) => row.stateComparisonCategory === "MISSING_FROM_UPLOAD");
  const completedOrCancelledRows = rows.filter(
    (row) => row.action !== "NEW_JOB" && (row.stateComparisonCategory === "COMPLETED" || row.stateComparisonCategory === "CANCELLED"),
  );

  return (
    <div className="mt-5 grid gap-5">
      <ResultSection emptyText="No state updates were found in this upload." rows={stateUpdatedRows} title="State Updated" />
      <ResultSection emptyText="No new jobs were found in this upload." rows={newJobRows} showPreviousState={false} title="New Jobs Added" />
      <ResultSection emptyText="No existing jobs are missing from this upload." rows={missingRows} title="Missing From Import" />
      <ResultSection
        emptyText="No jobs moved to completed or cancelled in this upload."
        rows={completedOrCancelledRows}
        title="Moved Out to Completed/Cancelled"
      />
    </div>
  );
}
