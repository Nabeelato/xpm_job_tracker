import { redirect } from "next/navigation";

export default function SoftwareBkJobsPage() {
  redirect("/jobs?department=SOFTWARE_BK&stateSet=workflow");
}
