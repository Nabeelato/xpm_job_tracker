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
