import Link from "next/link";
import type { ImportStatus } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/optimized-queries";
import { requireUser } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

function importStatusVariant(status: ImportStatus) {
  if (status === "APPLIED") return "success" as const;
  if (status === "FAILED") return "destructive" as const;
  return "warning" as const;
}

function MetricCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="p-5">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [metrics, latestImport] = await Promise.all([
    getDashboardMetrics(user),
    prisma.importBatch.findFirst({
      orderBy: { uploadedAt: "desc" },
      select: { id: true, fileName: true, status: true, uploadedAt: true, xpmDownloadedAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        action={user.role === "ADMIN" ? { href: "/imports/upload", label: "Upload Import" } : undefined}
        description="A quick view of what needs attention now."
        title="Dashboard"
      />
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last uploaded import file
          </div>
          {latestImport ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold">{formatDateTime(latestImport.uploadedAt)}</span>
                <Badge variant={importStatusVariant(latestImport.status)}>{latestImport.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono text-xs">{latestImport.fileName}</span>
                <span>XPM file date {formatDateTime(latestImport.xpmDownloadedAt)}</span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-lg font-semibold">No imports uploaded yet</div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/jobs" label="Total jobs" value={metrics.totalJobs} />
        <MetricCard href="/clients" label="Total clients" value={metrics.totalClients} />
        <MetricCard href="/clients/multiple" label="Clients with multiple jobs" value={metrics.clientsWithMultipleJobs} />
        <MetricCard href="/jobs?stateSet=main" label="Active jobs" value={metrics.mainJobs} />
        <MetricCard href="/jobs?department=VAT&stateSet=workflow" label="VAT jobs" value={metrics.vatJobs} />
        <MetricCard href="/jobs?department=SOFTWARE_BK&stateSet=workflow" label="Software BK jobs" value={metrics.softwareBkJobs} />
        <MetricCard href="/jobs?department=BK&stateSet=workflow" label="BK jobs" value={metrics.bkJobs} />
        <MetricCard href="/jobs?department=AFS&stateSet=workflow" label="AFS jobs" value={metrics.afsJobs} />
        <MetricCard href="/jobs?department=UNCLASSIFIED&stateSet=workflow" label="Unclassified jobs" value={metrics.unclassifiedJobs} />
        <MetricCard href="/jobs?assignedUserId=unassigned" label="Unassigned jobs" value={metrics.unassignedJobs} />
        <MetricCard href="/jobs/missing" label="Missing from latest file" value={metrics.missingJobs} />
        <MetricCard href="/jobs/completed" label="Completed jobs" value={metrics.completedJobs} />
        <MetricCard href="/jobs/cancelled" label="Cancelled jobs" value={metrics.cancelledJobs} />
      </div>
    </>
  );
}
