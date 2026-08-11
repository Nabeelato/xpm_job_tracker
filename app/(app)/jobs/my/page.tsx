import { JobListPage } from "@/components/job-list-page";

export default function MyJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/my"
      description="All jobs currently assigned to you."
      preset={{ myJobs: true, tabs: { assignees: true, departments: true, stateSets: true, states: "all" } }}
      searchParams={searchParams}
      title="My Jobs"
    />
  );
}
