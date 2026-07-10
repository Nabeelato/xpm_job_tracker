import { JobListPage } from "@/components/job-list-page";

export default function AvailableJobsQueuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/queue"
      description="Unassigned department jobs in workflow states 03 to 06. Claimed jobs leave this queue automatically."
      preset={{
        availableJobs: true,
        stateSet: "workflow",
        tabs: { departments: true, stateSets: false, states: "all" },
      }}
      searchParams={searchParams}
      title="Available Jobs Queue"
    />
  );
}
