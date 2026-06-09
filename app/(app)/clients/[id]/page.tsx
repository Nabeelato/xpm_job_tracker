import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientCategorySelect } from "@/components/client-category-select";
import { DepartmentBadge } from "@/components/department-badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookkeepingByLabels, bookkeepingSoftwareLabels, clientCategoryLabels } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { updateClientBookkeepingAction } from "@/app/(app)/clients/actions";

const departmentOrder = ["VAT", "SOFTWARE_BK", "BK", "AFS", "UNCLASSIFIED"];

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const jobVisibility = visibleJobsWhere(user);
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      category: true,
      bookkeepingSoftware: true,
      bookkeepingBy: true,
      jobs: {
        where: jobVisibility,
        select: {
          id: true,
          jobIdFromExcel: true,
          jobName: true,
          xpmState: true,
          internalStatus: true,
          missingFromLatestImport: true,
          archived: true,
          finalDepartment: { select: { code: true } },
          assignments: {
            where: { active: true },
            select: { user: { select: { name: true } } },
          },
        },
        orderBy: { jobIdFromExcel: "asc" },
      },
    },
  });

  if (!client || client.jobs.length === 0) notFound();

  const counts = {
    total: client.jobs.length,
    active: client.jobs.filter((job) => !job.archived).length,
    completed: client.jobs.filter((job) => job.internalStatus === "COMPLETED").length,
    missing: client.jobs.filter((job) => job.missingFromLatestImport).length,
    VAT: client.jobs.filter((job) => job.finalDepartment.code === "VAT").length,
    SOFTWARE_BK: client.jobs.filter((job) => job.finalDepartment.code === "SOFTWARE_BK").length,
    BK: client.jobs.filter((job) => job.finalDepartment.code === "BK").length,
    AFS: client.jobs.filter((job) => job.finalDepartment.code === "AFS").length,
    UNCLASSIFIED: client.jobs.filter((job) => job.finalDepartment.code === "UNCLASSIFIED").length,
  };

  const isAdmin = user.role === "ADMIN";
  const isSoftware = client.category === "SOFTWARE";

  return (
    <>
      <PageHeader title={client.displayName} description="Client detail with all visible jobs grouped by department." />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</span>
            {client.category ? (
              <Badge variant={client.category === "SOFTWARE" ? "softwareBk" : "bk"}>
                {clientCategoryLabels[client.category]}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Uncategorized</span>
            )}
          </div>
          {isAdmin ? <ClientCategorySelect clientId={client.id} current={client.category} /> : null}
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bookkeeping</span>
            {client.bookkeepingSoftware ? (
              <span className="text-sm font-medium">
                {bookkeepingSoftwareLabels[client.bookkeepingSoftware]}
                {client.bookkeepingBy === "CLIENT" ? " - Client" : ""}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Not set</span>
            )}
          </div>
          {isAdmin ? (
            <form action={updateClientBookkeepingAction} className="flex items-center gap-2 flex-wrap">
              <input name="clientId" type="hidden" value={client.id} />
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={client.bookkeepingSoftware ?? ""}
                name="bookkeepingSoftware"
              >
                <option value="">No software</option>
                {(Object.keys(bookkeepingSoftwareLabels) as (keyof typeof bookkeepingSoftwareLabels)[]).map((key) => (
                  <option key={key} value={key}>{bookkeepingSoftwareLabels[key]}</option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                defaultValue={client.bookkeepingBy ?? ""}
                name="bookkeepingBy"
              >
                <option value="">N/A</option>
                {(Object.keys(bookkeepingByLabels) as (keyof typeof bookkeepingByLabels)[]).map((key) => (
                  <option key={key} value={key}>{bookkeepingByLabels[key]}</option>
                ))}
              </select>
              <button
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                type="submit"
              >
                Save
              </button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <div className="mb-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Total jobs", counts.total],
          ["VAT jobs", counts.VAT],
          ["Software BK", counts.SOFTWARE_BK],
          ["BK jobs", counts.BK],
          ["AFS jobs", counts.AFS],
          ["Unclassified", counts.UNCLASSIFIED],
          ["Active", counts.active],
          ["Completed", counts.completed],
          ["Missing latest", counts.missing],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-5">
        {departmentOrder.map((code) => {
          const jobs = client.jobs.filter((job) => job.finalDepartment.code === code);
          return (
            <Card key={code}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DepartmentBadge code={code} />
                  <span>{code === "UNCLASSIFIED" ? "Unclassified Jobs" : code === "SOFTWARE_BK" ? "Software Bookkeeping Jobs" : `${code} Jobs`}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job No.</TableHead>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Job State</TableHead>
                        <TableHead>Internal Status</TableHead>
                        <TableHead>Assigned Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => {
                        return (
                          <TableRow
                            className={cn(isSoftware && "bg-yellow-100 hover:bg-yellow-200")}
                            key={job.id}
                          >
                            <TableCell className="font-medium">
                              <Link className="text-primary hover:underline" href={`/jobs/${job.id}`}>
                                {job.jobIdFromExcel}
                              </Link>
                            </TableCell>
                            <TableCell>{job.jobName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {job.xpmState ?? "-"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge value={job.internalStatus} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {job.assignments.length ? job.assignments.map((assignment) => assignment.user.name).join(", ") : "Unassigned"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No jobs in this department.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
