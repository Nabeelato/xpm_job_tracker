import { JobListPage } from "@/components/job-list-page";

export default function MissingJobsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <JobListPage basePath="/jobs/missing" description="Jobs that existed before but were absent from the latest confirmed import." preset={{ missing: true }} searchParams={searchParams} title="Missing From Latest Import" />;
}
