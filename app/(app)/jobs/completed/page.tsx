import { JobListPage } from "@/components/job-list-page";

export default function CompletedJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <JobListPage
      basePath="/jobs/completed"
      description="Jobs that have reached state 11."
      preset={{ stateGroup: "COMPLETED" }}
      searchParams={searchParams}
      title="Completed Jobs"
    />
  );
}
