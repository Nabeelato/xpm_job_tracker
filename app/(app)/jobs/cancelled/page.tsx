import { JobListPage } from "@/components/job-list-page";

export default function CancelledJobsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListPage
      basePath="/jobs/cancelled"
      description="Jobs imported with Job State 12."
      preset={{ stateGroup: "CANCELLED" }}
      searchParams={searchParams}
      title="Cancelled Jobs"
    />
  );
}
