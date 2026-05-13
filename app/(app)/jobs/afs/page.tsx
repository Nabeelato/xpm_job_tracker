import { redirect } from "next/navigation";

export default function AfsJobsPage() {
  redirect("/jobs?department=AFS&stateSet=workflow");
}
