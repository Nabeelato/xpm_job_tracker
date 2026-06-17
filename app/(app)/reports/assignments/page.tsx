import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { reportScopeWhere, reportUserScopeWhere } from "@/lib/reports";

export default async function AssignmentHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  const raw = (await searchParams) ?? {};
  const fromDate = typeof raw.from === "string" && raw.from ? raw.from : undefined;
  const toDate = typeof raw.to === "string" && raw.to ? raw.to : undefined;
  const roleFilter = typeof raw.role === "string" && raw.role ? raw.role : undefined;
  const nameSearch = typeof raw.name === "string" && raw.name ? raw.name.trim() : undefined;
  const changedById = typeof raw.changedById === "string" && raw.changedById ? raw.changedById : undefined;

  const where: Prisma.JobChangeLogWhereInput = {
    job: reportScopeWhere(user),
    fieldName: roleFilter === "supervisor"
      ? "supervisor_assignment"
      : roleFilter === "staff"
        ? "staff_assignment"
        : { in: ["supervisor_assignment", "staff_assignment"] },
    ...(fromDate || toDate
      ? {
          changedAt: {
            ...(fromDate ? { gte: new Date(fromDate) } : {}),
            ...(toDate ? { lte: new Date(`${toDate}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(changedById ? { changedById } : {}),
    ...(nameSearch
      ? {
          OR: [
            { oldValue: { contains: nameSearch, mode: "insensitive" as const } },
            { newValue: { contains: nameSearch, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [logs, users] = await Promise.all([
    prisma.jobChangeLog.findMany({
      where,
      orderBy: { changedAt: "desc" },
      take: 200,
      select: {
        id: true,
        changedAt: true,
        fieldName: true,
        oldValue: true,
        newValue: true,
        changedBy: { select: { name: true } },
        job: {
          select: {
            id: true,
            jobIdFromExcel: true,
            client: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true, AND: [reportUserScopeWhere(user)] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const currentParams = new URLSearchParams();
  if (fromDate) currentParams.set("from", fromDate);
  if (toDate) currentParams.set("to", toDate);
  if (roleFilter) currentParams.set("role", roleFilter);
  if (nameSearch) currentParams.set("name", nameSearch);
  if (changedById) currentParams.set("changedById", changedById);

  return (
    <>
      <PageHeader
        title="Assignment Change History"
        description="Log of all supervisor and staff assignment changes."
      />

      <Card className="mb-5">
        <CardContent className="p-4">
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">From</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={fromDate ?? ""}
                name="from"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">To</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={toDate ?? ""}
                name="to"
                type="date"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Role</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={roleFilter ?? ""}
                name="role"
              >
                <option value="">All</option>
                <option value="supervisor">Supervisor</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Name search</span>
              <input
                className="rounded-md border border-input bg-background px-2 py-1 text-sm min-w-[160px]"
                defaultValue={nameSearch ?? ""}
                name="name"
                placeholder="Assigned to..."
                type="text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Changed by</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={changedById ?? ""}
                name="changedById"
              >
                <option value="">Anyone</option>
                {users.map((changedBy) => (
                  <option key={changedBy.id} value={changedBy.id}>
                    {changedBy.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              type="submit"
            >
              Filter
            </button>
            {currentParams.toString() ? (
              <Link
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/40"
                href="/reports/assignments"
              >
                Clear
              </Link>
            ) : null}
            <a
              className="ml-auto rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              href={`/api/reports/assignments?${currentParams.toString()}`}
            >
              Download Excel
            </a>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {logs.length} {logs.length === 200 ? "(showing latest 200)" : "entries"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignment changes found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Job No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.changedAt).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" href={`/jobs/${log.job.id}`}>
                        {log.job.jobIdFromExcel}
                      </Link>
                    </TableCell>
                    <TableCell>{log.job.client.displayName}</TableCell>
                    <TableCell className="capitalize">
                      {log.fieldName === "supervisor_assignment" ? "Supervisor" : "Staff"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.oldValue ?? "—"}</TableCell>
                    <TableCell>{log.newValue ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{log.changedBy?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
