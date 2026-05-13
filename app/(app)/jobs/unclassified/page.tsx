import { redirect } from "next/navigation";

export default function UnclassifiedJobsPage() {
  redirect("/jobs?department=UNCLASSIFIED&stateSet=workflow");
}
