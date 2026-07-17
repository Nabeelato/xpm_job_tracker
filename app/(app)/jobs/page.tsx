import { JobListPage } from "@/components/job-list-page";

export default function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs"
      description="All jobs across every department, with state and assignee filters."
      preset={{ allJobs: true, tabs: { assignees: true, departments: true, stateSets: true, states: "all" } }}
      searchParams={searchParams}
      title="All Jobs"
    />
  );
}
