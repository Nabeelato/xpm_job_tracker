import { JobListPage } from "@/components/job-list-page";

export default function AvailableJobsQueuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/queue"
      description="Workflow 03 to 06 jobs across every department. Use department filters to find BK, Software BK, AFS, Unclassified, or VAT work."
      preset={{
        availableJobs: true,
        queueVacancyFilters: true,
        stateSet: "workflow",
        tabs: { departments: true, stateSets: false, states: "all" },
      }}
      searchParams={searchParams}
      title="Available Jobs Queue"
    />
  );
}
