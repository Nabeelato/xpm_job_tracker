import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { DepartmentBadge } from "@/components/department-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clientCategoryLabels } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { bkDepartmentConflictReasons, type BkDepartmentConflictReason } from "@/lib/bk-department-conflicts";
import { requireRole } from "@/lib/rbac";
import { searchParam } from "@/lib/utils";

const reasonLabels: Record<BkDepartmentConflictReason, string> = {
  mixed_departments: "Mixed BK / Software BK departments",
  mixed_source_partners: "Mixed Taaha / Irfan source partners",
};

export default async function BkConflictsReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["ADMIN"]);
  const rawParams = (await searchParams) ?? {};
  const query = searchParam(rawParams, "q")?.trim() ?? "";

  const clients = await prisma.client.findMany({
    where: {
      jobs: { some: { archived: false } },
      ...(query ? { displayName: { contains: query, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      displayName: true,
      category: true,
      jobs: {
        where: { archived: false },
        select: {
          id: true,
          jobIdFromExcel: true,
          jobName: true,
          sourceManagerName: true,
          sourcePartnerName: true,
          finalDepartment: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const conflicts = clients.flatMap((client) => {
    const reasons = bkDepartmentConflictReasons(client.jobs);
    return reasons.length ? [{ ...client, reasons }] : [];
  });

  return (
    <>
      <PageHeader
        description="Clients whose active jobs disagree on whether they're a software or manual bookkeeping client — split between BK/Software BK departments or between Taaha and Irfan as source partners."
        title="BK / Software Conflicts"
      />

      <form action="/reports/bk-conflicts" className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_auto]" method="GET">
        <Input defaultValue={query} name="q" placeholder="Search client name" />
        <Button className="w-full md:w-auto" loadingLabel="Filtering..." type="submit">Filter</Button>
      </form>

      {conflicts.length ? (
        <div className="space-y-4">
          {conflicts.map((client) => (
            <Card key={client.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>
                    <Link className="text-primary hover:underline" href={`/clients/${client.id}`}>
                      {client.displayName}
                    </Link>
                  </CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {client.category ? (
                      <Badge variant={client.category === "SOFTWARE" ? "softwareBk" : "bk"}>
                        {clientCategoryLabels[client.category]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No category set</span>
                    )}
                    {client.reasons.map((reason) => (
                      <Badge key={reason} variant="warning">{reasonLabels[reason]}</Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Job</th>
                        <th className="px-3 py-2">Job Name</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Source Manager</th>
                        <th className="px-3 py-2">Source Partner</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {client.jobs.map((job) => (
                        <tr className="border-t" key={job.id}>
                          <td className="px-3 py-2 font-medium">{job.jobIdFromExcel}</td>
                          <td className="px-3 py-2">{job.jobName}</td>
                          <td className="px-3 py-2"><DepartmentBadge code={job.finalDepartment.code} /></td>
                          <td className="px-3 py-2">{job.sourceManagerName?.trim() || "—"}</td>
                          <td className="px-3 py-2">{job.sourcePartnerName?.trim() || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <Link className="text-primary hover:underline" href={`/jobs/${job.id}`}>Review</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No conflicts" description="No clients currently have contradicting BK / Software BK jobs." />
      )}
    </>
  );
}
