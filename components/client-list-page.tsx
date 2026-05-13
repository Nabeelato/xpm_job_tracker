import Link from "next/link";
import { ClientFilters } from "@/components/client-filters";
import { DepartmentBadge } from "@/components/department-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClientSummaries, type ClientFilter } from "@/lib/optimized-queries";
import { requireUser } from "@/lib/rbac";
import { searchParam, toInt } from "@/lib/utils";

export async function ClientListPage({
  title,
  description,
  searchParams,
  presetFilter,
  basePath,
}: {
  title: string;
  description?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  presetFilter?: ClientFilter;
  basePath: string;
}) {
  const user = await requireUser();
  const rawParams = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value) params.set(key, value);
  }

  const page = toInt(searchParam(rawParams, "page"), 1);
  const pageSize = 25;
  const query = searchParam(rawParams, "q");
  const filter = presetFilter ?? searchParam(rawParams, "filter");
  const { summaries, total } = await getClientSummaries({ user, query, filter, page, pageSize });

  return (
    <>
      <PageHeader title={title} description={description} />
      <ClientFilters params={params} />
      {summaries.length === 0 ? (
        <EmptyState title="No clients found" description="Try a different client filter or upload the latest source file." />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Department Mix</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>48h Stale</TableHead>
                <TableHead>Missing Latest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link className="text-primary hover:underline" href={`/clients/${client.id}`}>
                      {client.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>{client.totalJobs}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(client.departmentCounts)
                        .filter(([, count]) => count > 0)
                        .map(([code, count]) => (
                          <span className="inline-flex items-center gap-1" key={code}>
                            <DepartmentBadge code={code} />
                            <span className="text-xs text-muted-foreground">{count}</span>
                          </span>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>{client.activeJobs}</TableCell>
                  <TableCell>{client.completedJobs}</TableCell>
                  <TableCell>{client.stale48Jobs}</TableCell>
                  <TableCell>{client.missingJobs}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination basePath={basePath} page={page} pageSize={pageSize} params={params} total={total} />
    </>
  );
}
