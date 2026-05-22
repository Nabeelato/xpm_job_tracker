---
name: restore-stale-jobs
description: Restore the Stale Jobs feature (48h+ unchanged in Job States 03-06) that was removed on 2026-05-19. Re-creates the Stale Jobs page, Stale Clients page, sidebar nav entry, dashboard metric card, client list "48h Stale" column, client-filter option, per-row stale badges on All Jobs / Job detail / Client detail tables, and the supporting helpers in lib/job-state.ts and lib/optimized-queries.ts. Use when the user asks to "bring back stale jobs", "restore the 48h stale feature", or similar.
---

# Restore Stale Jobs Feature

The Stale Jobs feature flags jobs that have been sitting in workflow states **03–06** for **24+ hours (warning)** or **48+ hours (critical)** without their state changing. It surfaces these as:

- A sidebar nav entry **Stale 48h+** → `/jobs/stale-48`
- A **Stale jobs** dashboard metric card
- A standalone **Stale Clients** page at `/clients/stale-48`
- A **48h Stale** column on the client list page + a `stale_48` client filter
- Inline orange/red badges (`24h+ unchanged (Nh)` / `48h+ unchanged (Nh)`) on each row of the All Jobs table, the Client detail page, and the Job detail page
- Critical-stale rows in the All Jobs table get a dark red background (`bg-red-950 text-white`)

It was removed because the user said they no longer needed it. This skill restores it exactly as it was.

## Apply this skill

Make the following edits in order. After each `Add` step the corresponding file must exist or be edited as shown. Run `npx tsc --noEmit` at the end to verify.

---

### 1. `lib/job-state.ts` — add back the helpers

Inside this file, **add** the following exports (alongside the existing `JobStateGroup`, `parseJobStateNumber`, `isMainState`, `stateGroupForNumber`, `stateGroupWhere`):

```ts
export type StaleLevel = "none" | "warning" | "critical";

const staleTrackedStateNumbers = new Set([3, 4, 5, 6]);

export function isStaleTrackedState(number: number | null | undefined) {
  return typeof number === "number" && staleTrackedStateNumbers.has(number);
}

export function getStaleLevel(
  stateNumber: number | null | undefined,
  stateEnteredAt: Date | string | null | undefined,
  now = new Date(),
): StaleLevel {
  if (!isStaleTrackedState(stateNumber) || !stateEnteredAt) return "none";
  const enteredAt = stateEnteredAt instanceof Date ? stateEnteredAt : new Date(stateEnteredAt);
  if (Number.isNaN(enteredAt.getTime())) return "none";
  const hours = (now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60);
  if (hours >= 48) return "critical";
  if (hours >= 24) return "warning";
  return "none";
}

export function hoursInState(stateEnteredAt: Date | string | null | undefined, now = new Date()) {
  if (!stateEnteredAt) return null;
  const enteredAt = stateEnteredAt instanceof Date ? stateEnteredAt : new Date(stateEnteredAt);
  if (Number.isNaN(enteredAt.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60)));
}
```

---

### 2. `lib/optimized-queries.ts` — add staleJobs metric, stale48Jobs per-client, stale_48 filter

In the `DashboardMetrics` type, add:
```ts
staleJobs: number;
```

In the `ClientFilter` union, add `| "stale_48"`.

In the `ClientSummary` type, add:
```ts
stale48Jobs: number;
```

In the `ClientSummaryRow` type, add:
```ts
stale48Jobs: CountValue;
```

In `clientFilterSql`, add before the `missing` case:
```ts
if (filter === "stale_48") return Prisma.sql`WHERE "stale48Jobs" > 0`;
```

In `getDashboardMetrics`, add `const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);` at the top of the function and add this SELECT column to the raw SQL (last column, before the closing `FROM visible_jobs`):
```sql
,
(COUNT(*) FILTER (
  WHERE job_state_number IN (3, 4, 5, 6)
    AND state_entered_at <= ${staleThreshold}
))::int AS "staleJobs"
```
Then add `staleJobs: toNumber(row?.staleJobs)` to the returned object.

In `getClientSummaries`, add `const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);` at the top, then add this column to the `client_summaries` CTE (right after `missingJobs`):
```sql
(COUNT(*) FILTER (
  WHERE job_state_number IN (3, 4, 5, 6)
    AND state_entered_at <= ${staleThreshold}
))::int AS "stale48Jobs",
```
Then add `stale48Jobs: toNumber(row.stale48Jobs)` to the mapped object.

---

### 3. `components/nav-config.ts` — add the sidebar entry

Add `Clock` to the lucide-react import list, then insert between "My Jobs" and "Completed":
```ts
{ href: "/jobs/stale-48", label: "Stale 48h+", icon: Clock },
```

---

### 4. `components/job-section-tabs.tsx` — add the tab

In `JOB_TABS`, add between `my` and `completed`:
```ts
{ key: "stale",     label: "Stale 48h+" },
```
In `jobTabHref`, add:
```ts
stale: "/jobs/stale-48",
```

---

### 5. `app/(app)/dashboard/page.tsx` — add the metric card

In the metric grid, add (typically right before "Completed jobs" or "Cancelled jobs"):
```tsx
<MetricCard href="/jobs/stale-48" label="Stale jobs" value={metrics.staleJobs} />
```

---

### 6. `app/(app)/jobs/stale-48/page.tsx` — create this file

```tsx
import { JobListPage } from "@/components/job-list-page";

const workflowStates = [3, 4, 5, 6];

export default function StaleJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/stale-48"
      description="Jobs in states 03–06 that have not changed state for at least 48 hours."
      preset={{ staleHours: 48, stateNumbers: workflowStates, tabs: { assignees: true, departments: true, states: workflowStates } }}
      searchParams={searchParams}
      title="Stale Jobs (48h+)"
    />
  );
}
```

---

### 7. `app/(app)/clients/stale-48/page.tsx` — create this file

```tsx
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
```

---

### 8. `components/job-list-page.tsx` — add staleHours preset + per-row badges + row highlighting

Re-add to the import line for `@/lib/job-state`: `getStaleLevel, hoursInState` (keep the existing `stateGroupWhere, type JobStateGroup`).

Add `staleHours?: number;` to the `Preset` type.

In the filter assembly, add after the `priority` block:
```ts
if (effectivePreset.staleHours) {
  const threshold = new Date(Date.now() - effectivePreset.staleHours * 60 * 60 * 1000);
  and.push({ jobStateNumber: { in: [3, 4, 5, 6] }, stateEnteredAt: { lte: threshold } });
}
```

In the row map, compute and use stale info:
```tsx
const staleLevel = getStaleLevel(job.jobStateNumber, job.stateEnteredAt);
const staleHours = hoursInState(job.stateEnteredAt);
```

Apply row background:
```tsx
<TableRow
  className={cn(
    staleLevel === "warning" && "bg-red-50",
    staleLevel === "critical" && "bg-red-950 text-white hover:bg-red-900",
  )}
  key={job.id}
>
```

Apply text override on the job-no link:
```tsx
className={cn("text-primary hover:underline", staleLevel === "critical" && "text-white")}
```

In the Source State cell, render the badge:
```tsx
<span className={cn("text-muted-foreground", staleLevel === "critical" && "text-red-100")}>
  {job.xpmState ?? "-"}
</span>
{staleLevel !== "none" ? (
  <Badge variant={staleLevel === "critical" ? "destructive" : "warning"}>
    {staleLevel === "critical" ? "48h+ unchanged" : "24h+ unchanged"}
    {typeof staleHours === "number" ? ` (${staleHours}h)` : ""}
  </Badge>
) : null}
```

In the Assigned Users cell, the className should be:
```tsx
className={cn("text-muted-foreground", staleLevel === "critical" && "text-red-100")}
```

And pass `dark={staleLevel === "critical"}` to `<AssignCell>`.

---

### 9. `app/(app)/jobs/[id]/page.tsx` — restore the job-detail stale indicator

Add import: `import { getStaleLevel, hoursInState } from "@/lib/job-state";`

Compute near the top of the component body:
```tsx
const staleLevel = getStaleLevel(job.jobStateNumber, job.stateEnteredAt);
const staleHours = hoursInState(job.stateEnteredAt);
```

In the Source State `<dd>`, render:
```tsx
<div className="flex flex-col gap-1">
  <span>{job.xpmState ?? "-"}</span>
  {staleLevel !== "none" ? (
    <span className={staleLevel === "critical" ? "text-sm font-semibold text-destructive" : "text-sm font-medium text-orange-700"}>
      {staleLevel === "critical" ? "48h+ unchanged" : "24h+ unchanged"}
      {typeof staleHours === "number" ? ` (${staleHours}h)` : ""}
    </span>
  ) : null}
</div>
```

---

### 10. `app/(app)/clients/[id]/page.tsx` — restore the per-job stale badge + "48h stale" count

Add import: `import { getStaleLevel, hoursInState } from "@/lib/job-state";`

In the `counts` object, add:
```ts
stale48: client.jobs.filter((job) => getStaleLevel(job.jobStateNumber, job.stateEnteredAt) === "critical").length,
```

In the counts card grid, add the tuple `["48h stale", counts.stale48],` (typically after `["Completed", counts.completed]`).

In the per-department job rows map, compute:
```tsx
const staleLevel = getStaleLevel(job.jobStateNumber, job.stateEnteredAt);
const staleHours = hoursInState(job.stateEnteredAt);
```

Wrap the `xpmState` cell content as:
```tsx
<div className="flex flex-col gap-1">
  <span>{job.xpmState ?? "-"}</span>
  {staleLevel !== "none" ? (
    <Badge variant={staleLevel === "critical" ? "destructive" : "warning"}>
      {staleLevel === "critical" ? "48h+ unchanged" : "24h+ unchanged"}
      {typeof staleHours === "number" ? ` (${staleHours}h)` : ""}
    </Badge>
  ) : null}
</div>
```

---

### 11. `components/client-list-page.tsx` — restore the 48h Stale column

Add `<TableHead>48h Stale</TableHead>` between `Completed` and `Missing Latest`.

Add the matching `<TableCell>{client.stale48Jobs}</TableCell>` in the body row.

---

### 12. `components/client-filters.tsx` — restore the filter option

Add between `unclassified` and `missing`:
```tsx
<option value="stale_48">Not updated 48 hours</option>
```

---

### Verify

```
npx tsc --noEmit
docker compose up -d --build
```

Visit:
- http://localhost:3000/jobs/stale-48 — stale jobs list
- http://localhost:3000/clients/stale-48 — stale clients list
- http://localhost:3000/dashboard — Stale jobs metric card present
- http://localhost:3000/jobs — rows in states 03-06 unchanged 24h+ should show orange badge; 48h+ should show red row + destructive badge
