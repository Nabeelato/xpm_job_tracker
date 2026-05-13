import Link from "next/link";
import { DepartmentBadge } from "@/components/department-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { jobStateOptions } from "@/lib/constants";
import { normalizeClientName } from "@/lib/import/normalize";
import { cn } from "@/lib/utils";

export type ImportBreakdownRow = {
  id: string;
  rowNumber: number;
  action: string;
  detectedJobId: string | null;
  detectedClientName: string | null;
  detectedJobName: string | null;
  detectedDepartmentCode: string | null;
  matchedClientId: string | null;
  newXpmState: string | null;
  newStateNumber: number | null;
};

const importableActions = new Set(["NEW_JOB", "UPDATE_JOB", "UNCHANGED"]);
const stateNumbers = [2, 3, 4, 5, 6];
const departmentStateNumbers = new Set([3, 4, 5, 6]);
const departmentSections = [
  { code: "VAT", title: "VAT", href: "/jobs?department=VAT&stateSet=workflow" },
  { code: "SOFTWARE_BK", title: "Software Bookkeeping", href: "/jobs?department=SOFTWARE_BK&stateSet=workflow" },
  { code: "BK", title: "Bookkeeping", href: "/jobs?department=BK&stateSet=workflow" },
  { code: "AFS", title: "AFS", href: "/jobs?department=AFS&stateSet=workflow" },
  { code: "UNCLASSIFIED", title: "Unclassified", href: "/jobs?department=UNCLASSIFIED&stateSet=workflow" },
] as const;

function isImportable(row: ImportBreakdownRow) {
  return importableActions.has(row.action);
}

function stateLabel(number: number | null) {
  if (!number) return "-";
  return jobStateOptions.find((state) => state.number === number)?.label ?? `State ${number}`;
}

function sortedRows(rows: ImportBreakdownRow[]) {
  return [...rows].sort((a, b) => {
    const clientSort = (a.detectedClientName ?? "").localeCompare(b.detectedClientName ?? "");
    if (clientSort !== 0) return clientSort;
    return (a.detectedJobId ?? "").localeCompare(b.detectedJobId ?? "");
  });
}

function clientCount(rows: ImportBreakdownRow[]) {
  return new Set(rows.map((row) => normalizeClientName(row.detectedClientName)).filter(Boolean)).size;
}

function ImportRowsTable({ rows, emptyText }: { rows: ImportBreakdownRow[]; emptyText: string }) {
  const orderedRows = sortedRows(rows);

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
          <TableHead>Department</TableHead>
          <TableHead>Source State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderedRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.detectedClientName ?? "-"}</TableCell>
            <TableCell>{row.detectedJobId ?? "-"}</TableCell>
            <TableCell className="max-w-md">{row.detectedJobName ?? "-"}</TableCell>
            <TableCell>
              <DepartmentBadge code={row.detectedDepartmentCode} />
            </TableCell>
            <TableCell>{row.newXpmState ?? stateLabel(row.newStateNumber)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NewCompaniesSection({ rows }: { rows: ImportBreakdownRow[] }) {
  const companiesByKey = new Map<
    string,
    {
      key: string;
      name: string;
      jobs: number;
      departments: Set<string>;
      states: Set<number>;
    }
  >();

  for (const row of rows) {
    if (row.matchedClientId || !row.detectedClientName) continue;
    const normalizedKey = normalizeClientName(row.detectedClientName) || row.detectedClientName;
    const company = companiesByKey.get(normalizedKey) ?? {
      key: normalizedKey,
      name: row.detectedClientName,
      jobs: 0,
      departments: new Set<string>(),
      states: new Set<number>(),
    };
    company.jobs += 1;
    if (row.detectedDepartmentCode) company.departments.add(row.detectedDepartmentCode);
    if (row.newStateNumber) company.states.add(row.newStateNumber);
    companiesByKey.set(normalizedKey, company);
  }

  const companies = [...companiesByKey.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>New Added Companies</CardTitle>
        <Badge variant="secondary">{companies.length}</Badge>
      </CardHeader>
      <CardContent>
        {companies.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>States</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.key}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.jobs}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {[...company.departments].sort().map((department) => (
                        <DepartmentBadge code={department} key={department} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{[...company.states].sort((a, b) => a - b).map((state) => stateLabel(state)).join(", ") || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No new companies were found in this upload.</p>
        )}
      </CardContent>
    </Card>
  );
}

function StateSections({ rows }: { rows: ImportBreakdownRow[] }) {
  return (
    <div className="grid gap-5">
      {stateNumbers.map((stateNumber) => {
        const stateRows = rows.filter((row) => row.newStateNumber === stateNumber);
        const companies = clientCount(stateRows);
        return (
          <Card key={stateNumber}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle>{stateLabel(stateNumber)}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {companies} companies, {stateRows.length} jobs in this upload
                </div>
              </div>
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} href={`/jobs?jobStateNumber=${stateNumber}`}>
                Current list
              </Link>
            </CardHeader>
            <CardContent>
              <ImportRowsTable rows={stateRows} emptyText="No clients in this state for this upload." />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DepartmentSections({ rows }: { rows: ImportBreakdownRow[] }) {
  return (
    <div className="grid gap-5">
      {departmentSections.map((department) => {
        const departmentRows = rows.filter(
          (row) => row.detectedDepartmentCode === department.code && row.newStateNumber !== null && departmentStateNumbers.has(row.newStateNumber),
        );
        const companies = clientCount(departmentRows);
        return (
          <Card key={department.code}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle>{department.title}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {companies} companies, {departmentRows.length} jobs in states 03-06
                </div>
              </div>
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")} href={department.href}>
                Current list
              </Link>
            </CardHeader>
            <CardContent>
              <ImportRowsTable rows={departmentRows} emptyText="No clients in states 03-06 for this department." />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ImportBatchBreakdown({ rows }: { rows: ImportBreakdownRow[] }) {
  const importableRows = rows.filter(isImportable);

  return (
    <div className="mt-5 grid gap-5">
      <NewCompaniesSection rows={importableRows} />
      <StateSections rows={importableRows} />
      <DepartmentSections rows={importableRows} />
    </div>
  );
}
