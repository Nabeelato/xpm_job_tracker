import { JobListPage } from "@/components/job-list-page";

const workflowStates = [3, 4, 5, 6];

export default function MyJobsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <JobListPage
      basePath="/jobs/my"
      description="Jobs assigned to you in states 03 to 06."
      preset={{ myJobs: true, stateNumbers: workflowStates, tabs: { departments: true, states: workflowStates } }}
      searchParams={searchParams}
      title="My Jobs"
    />
  );
}
