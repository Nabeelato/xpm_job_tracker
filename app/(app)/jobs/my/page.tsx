import { JobListPage } from "@/components/job-list-page";

export default function MyJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/my"
      description="Jobs assigned to you, with workflow states 03 to 06 as the default filter."
      preset={{ myJobs: true, stateSet: "workflow", tabs: { assignees: true, departments: true, stateSets: true, states: "all" } }}
      searchParams={searchParams}
      title="My Jobs"
    />
  );
}
