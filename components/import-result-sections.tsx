import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  matchedJobName?: string | null;
  matchedClientName?: string | null;
};

function stateText(sourceState: string | null, stateNumber: number | null) {
  if (sourceState) return sourceState;
  if (stateNumber) return `State ${stateNumber}`;
  return "-";
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function clientNameChanged(row: ImportResultRow) {
  if (!row.matchedClientName) return false;
  return normalize(row.detectedClientName) !== normalize(row.matchedClientName);
}

function jobNameChanged(row: ImportResultRow) {
  if (!row.matchedJobName) return false;
  return normalize(row.detectedJobName) !== normalize(row.matchedJobName);
}

function hasNameChange(row: ImportResultRow) {
  return clientNameChanged(row) || jobNameChanged(row);
}

function isBackwardStateMove(row: ImportResultRow) {
  return (
    row.previousStateNumber != null &&
    row.newStateNumber != null &&
    row.previousStateNumber > row.newStateNumber
  );
}

function orderByClient(rows: ImportResultRow[]) {
  return [...rows].sort((a, b) => {
    const clientSort = (a.detectedClientName ?? "").localeCompare(b.detectedClientName ?? "");
    if (clientSort !== 0) return clientSort;
    return (a.detectedJobId ?? "").localeCompare(b.detectedJobId ?? "");
  });
}

function orderByNewState(rows: ImportResultRow[]) {
  return [...rows].sort((a, b) => {
    const aState = a.newStateNumber ?? Number.MAX_SAFE_INTEGER;
    const bState = b.newStateNumber ?? Number.MAX_SAFE_INTEGER;
    if (aState !== bState) return aState - bState;
    return (a.detectedClientName ?? "").localeCompare(b.detectedClientName ?? "");
  });
}

function StateRowTable({
  rows,
  emptyText,
  showPreviousState = true,
  highlightBackward = false,
}: {
  rows: ImportResultRow[];
  emptyText: string;
  showPreviousState?: boolean;
  highlightBackward?: boolean;
}) {
  const visible = rows.slice(0, 100);

  if (!visible.length) {
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
        {visible.map((row) => {
          const backward = highlightBackward && isBackwardStateMove(row);
          return (
            <TableRow
              className={cn(backward && "bg-orange-100 hover:bg-orange-200")}
              key={row.id}
            >
              <TableCell className="font-medium">{row.detectedClientName ?? "-"}</TableCell>
              <TableCell>{row.detectedJobId ?? "-"}</TableCell>
              <TableCell className="max-w-md">{row.detectedJobName ?? "-"}</TableCell>
              {showPreviousState ? <TableCell>{stateText(row.previousXpmState, row.previousStateNumber)}</TableCell> : null}
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{stateText(row.newXpmState, row.newStateNumber)}</span>
                  {backward ? <Badge variant="warning">Backward</Badge> : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function NameChangeTable({ rows, emptyText }: { rows: ImportResultRow[]; emptyText: string }) {
  const visible = rows.slice(0, 100);

  if (!visible.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job No.</TableHead>
          <TableHead>Client (was → now)</TableHead>
          <TableHead>Job Name (was → now)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row) => {
          const clientChanged = clientNameChanged(row);
          const jobChanged = jobNameChanged(row);
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.detectedJobId ?? "-"}</TableCell>
              <TableCell>
                {clientChanged ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-muted-foreground line-through">{row.matchedClientName ?? "-"}</span>
                    <span aria-hidden="true">→</span>
                    <span className="font-medium">{row.detectedClientName ?? "-"}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{row.matchedClientName ?? row.detectedClientName ?? "-"}</span>
                )}
              </TableCell>
              <TableCell className="max-w-md">
                {jobChanged ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-muted-foreground line-through">{row.matchedJobName ?? "-"}</span>
                    <span aria-hidden="true">→</span>
                    <span className="font-medium">{row.detectedJobName ?? "-"}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{row.matchedJobName ?? row.detectedJobName ?? "-"}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SectionCard({
  title,
  count,
  children,
  showOverflow,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  showOverflow: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent>
        {children}
        {showOverflow ? <p className="mt-3 text-xs text-muted-foreground">Showing first 100 rows.</p> : null}
      </CardContent>
    </Card>
  );
}

export function ImportResultSections({ rows }: { rows: ImportResultRow[] }) {
  const newJobRows = orderByNewState(rows.filter((row) => row.action === "NEW_JOB"));
  const nameChangeRows = orderByClient(rows.filter((row) => row.action !== "NEW_JOB" && hasNameChange(row)));
  const stateUpdatedRows = orderByNewState(rows.filter((row) => row.stateComparisonCategory === "STATE_UPDATED"));
  const completedOrCancelledRows = orderByClient(
    rows.filter(
      (row) =>
        row.action !== "NEW_JOB" &&
        (row.stateComparisonCategory === "COMPLETED" || row.stateComparisonCategory === "CANCELLED") &&
        row.previousStateNumber !== row.newStateNumber,
    ),
  );
  const missingRows = orderByClient(rows.filter((row) => row.stateComparisonCategory === "MISSING_FROM_UPLOAD"));

  return (
    <div className="mt-5 grid gap-5">
      <SectionCard count={newJobRows.length} showOverflow={newJobRows.length > 100} title="New Jobs Added">
        <StateRowTable emptyText="No new jobs were found in this upload." rows={newJobRows} showPreviousState={false} />
      </SectionCard>

      <SectionCard count={nameChangeRows.length} showOverflow={nameChangeRows.length > 100} title="Name Changes">
        <NameChangeTable emptyText="No client or job names changed in this upload." rows={nameChangeRows} />
      </SectionCard>

      <SectionCard count={stateUpdatedRows.length} showOverflow={stateUpdatedRows.length > 100} title="State Updated">
        <StateRowTable
          emptyText="No state updates were found in this upload."
          highlightBackward
          rows={stateUpdatedRows}
        />
      </SectionCard>

      <SectionCard
        count={completedOrCancelledRows.length}
        showOverflow={completedOrCancelledRows.length > 100}
        title="Moved Out to Completed/Cancelled"
      >
        <StateRowTable
          emptyText="No jobs moved to completed or cancelled in this upload."
          rows={completedOrCancelledRows}
        />
      </SectionCard>

      <SectionCard count={missingRows.length} showOverflow={missingRows.length > 100} title="Missing From Import">
        <StateRowTable
          emptyText="No existing jobs are missing from this upload."
          rows={missingRows}
        />
      </SectionCard>
    </div>
  );
}
