import Link from "next/link";
import { DepartmentBadge } from "@/components/department-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { hoursInState } from "@/lib/job-state";
import { requireUser, visibleJobsWhere } from "@/lib/rbac";

export default async function StaleClientsPage() {
  const user = await requireUser();
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const jobVisibility = visibleJobsWhere(user);
  const clients = await prisma.client.findMany({
    where: {
      jobs: {
        some: {
          AND: [
            jobVisibility,
            {
              jobStateNumber: { in: [3, 4, 5, 6] },
              stateEnteredAt: { lte: threshold },
              archived: false,
            },
          ],
        },
      },
    },
    include: {
      jobs: {
        where: {
          AND: [
            jobVisibility,
            {
              jobStateNumber: { in: [3, 4, 5, 6] },
              stateEnteredAt: { lte: threshold },
              archived: false,
            },
          ],
        },
        select: {
          id: true,
          jobIdFromExcel: true,
          xpmState: true,
          stateEnteredAt: true,
          finalDepartment: { select: { code: true } },
        },
        orderBy: { stateEnteredAt: "asc" },
      },
    },
    orderBy: { displayName: "asc" },
  });

  return (
    <>
      <PageHeader description="Clients with at least one visible job unchanged for 48 hours in Job State 03 to 06." title="Clients Not Updated 48 Hours" />
      {clients.length ? (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Affected Jobs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="align-top font-medium">
                    <Link className="text-primary hover:underline" href={`/clients/${client.id}`}>
                      {client.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {client.jobs.map((job) => (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2" key={job.id}>
                          <Link className="font-medium text-primary hover:underline" href={`/jobs/${job.id}`}>
                            {job.jobIdFromExcel}
                          </Link>
                          <DepartmentBadge code={job.finalDepartment.code} />
                          <span className="text-sm text-muted-foreground">{job.xpmState ?? "-"}</span>
                          <Badge variant="destructive">{hoursInState(job.stateEnteredAt) ?? 48}h unchanged</Badge>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No 48-hour stale clients" description="Clients will appear here when a visible job stays in Job State 03 to 06 for at least 48 hours." />
      )}
    </>
  );
}
