import { JobListPage } from "@/components/job-list-page";

export default function AvailableJobsQueuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/queue"
      description="Workflow 03 to 06 jobs with no assignee in your role. A manager, supervisor, or staff claim removes the job from their role's queue."
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
