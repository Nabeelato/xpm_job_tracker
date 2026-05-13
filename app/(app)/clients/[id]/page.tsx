import Link from "next/link";
import { notFound } from "next/navigation";
import { DepartmentBadge } from "@/components/department-badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { getStaleLevel, hoursInState } from "@/lib/job-state";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";

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
      jobs: {
        where: jobVisibility,
        select: {
          id: true,
          jobIdFromExcel: true,
          jobName: true,
          xpmState: true,
          jobStateNumber: true,
          stateEnteredAt: true,
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
    stale48: client.jobs.filter((job) => getStaleLevel(job.jobStateNumber, job.stateEnteredAt) === "critical").length,
    VAT: client.jobs.filter((job) => job.finalDepartment.code === "VAT").length,
    SOFTWARE_BK: client.jobs.filter((job) => job.finalDepartment.code === "SOFTWARE_BK").length,
    BK: client.jobs.filter((job) => job.finalDepartment.code === "BK").length,
    AFS: client.jobs.filter((job) => job.finalDepartment.code === "AFS").length,
    UNCLASSIFIED: client.jobs.filter((job) => job.finalDepartment.code === "UNCLASSIFIED").length,
  };

  return (
    <>
      <PageHeader title={client.displayName} description="Client detail with all visible jobs grouped by department." />
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
          ["48h stale", counts.stale48],
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
                        const staleLevel = getStaleLevel(job.jobStateNumber, job.stateEnteredAt);
                        const staleHours = hoursInState(job.stateEnteredAt);
                        return (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">
                              <Link className="text-primary hover:underline" href={`/jobs/${job.id}`}>
                                {job.jobIdFromExcel}
                              </Link>
                            </TableCell>
                            <TableCell>{job.jobName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              <div className="flex flex-col gap-1">
                                <span>{job.xpmState ?? "-"}</span>
                                {staleLevel !== "none" ? (
                                  <Badge variant={staleLevel === "critical" ? "destructive" : "warning"}>
                                    {staleLevel === "critical" ? "48h+ unchanged" : "24h+ unchanged"}
                                    {typeof staleHours === "number" ? ` (${staleHours}h)` : ""}
                                  </Badge>
                                ) : null}
                              </div>
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
