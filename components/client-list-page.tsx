import Link from "next/link";
import { Download } from "lucide-react";
import { ClientBookkeepingInline } from "@/components/client-bookkeeping-inline";
import { ClientFilters } from "@/components/client-filters";
import { DepartmentBadge } from "@/components/department-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookkeepingByLabels, bookkeepingSoftwareLabels, clientCategoryLabels } from "@/lib/constants";
import { getClientSummaries, type ClientFilter } from "@/lib/optimized-queries";
import { requireUser } from "@/lib/rbac";
import { cn, searchParam, toInt } from "@/lib/utils";

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
  const isAdmin = user.role === "ADMIN";
  const rawParams = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value) params.set(key, value);
  }

  const page = toInt(searchParam(rawParams, "page"), 1);
  const pageSize = 25;
  const query = searchParam(rawParams, "q");
  const filter = presetFilter ?? searchParam(rawParams, "filter");
  const bookkeepingSoftware = searchParam(rawParams, "bookkeepingSoftware");
  const bookkeepingBy = searchParam(rawParams, "bookkeepingBy");
  const { summaries, total } = await getClientSummaries({
    user,
    query,
    filter,
    bookkeepingSoftware,
    bookkeepingBy,
    page,
    pageSize,
  });

  const exportParams = new URLSearchParams(params);
  if (presetFilter) exportParams.set("filter", presetFilter);
  exportParams.delete("page");
  exportParams.set("scope", "visible");
  const exportHref = `/api/reports/clients/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <>
      <PageHeader title={title} description={description} />
      <ClientFilters params={params} />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          Showing <span className="font-medium text-foreground">{summaries.length}</span> of{" "}
          <span className="font-medium text-foreground">{total}</span> matching clients
        </span>
        <Link className={cn(buttonVariants({ variant: "outline" }), "self-start")} href={exportHref}>
          <Download className="h-4 w-4" />
          Export Excel
        </Link>
      </div>
      {summaries.length === 0 ? (
        <EmptyState title="No clients found" description="Try a different client filter or upload the latest source file." />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Bookkeeping</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Department Mix</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Missing Latest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((client) => (
                <TableRow
                  className={cn(client.category === "SOFTWARE" && "bg-yellow-100 hover:bg-yellow-200")}
                  key={client.id}
                >
                  <TableCell className="font-medium">
                    <Link className="text-primary hover:underline" href={`/clients/${client.id}`}>
                      {client.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <ClientBookkeepingInline
                        bookkeepingBy={client.bookkeepingBy}
                        bookkeepingSoftware={client.bookkeepingSoftware}
                        category={client.category}
                        clientId={client.id}
                      />
                    ) : client.category ? (
                      <Badge variant={client.category === "SOFTWARE" ? "softwareBk" : "bk"}>
                        {clientCategoryLabels[client.category]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!isAdmin && (client.bookkeepingSoftware || client.bookkeepingBy) ? (
                      <span className="text-xs text-muted-foreground">
                        {client.bookkeepingSoftware ? bookkeepingSoftwareLabels[client.bookkeepingSoftware] : ""}
                        {client.bookkeepingSoftware && client.bookkeepingBy ? " · " : ""}
                        {client.bookkeepingBy ? bookkeepingByLabels[client.bookkeepingBy] : ""}
                      </span>
                    ) : !isAdmin ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
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
