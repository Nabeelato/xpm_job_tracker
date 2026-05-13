import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/optimized-queries";
import { requireUser } from "@/lib/rbac";

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
  const metrics = await getDashboardMetrics(user);

  return (
    <>
      <PageHeader description="A quick view of what needs attention now." title="Dashboard" />
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
        <MetricCard href="/jobs/stale-48" label="Stale jobs" value={metrics.staleJobs} />
        <MetricCard href="/jobs/completed" label="Completed jobs" value={metrics.completedJobs} />
        <MetricCard href="/jobs/cancelled" label="Cancelled jobs" value={metrics.cancelledJobs} />
      </div>
    </>
  );
}
