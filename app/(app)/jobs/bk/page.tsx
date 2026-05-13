import { redirect } from "next/navigation";

export default function BkJobsPage() {
  redirect("/jobs?department=BK&stateSet=workflow");
}
