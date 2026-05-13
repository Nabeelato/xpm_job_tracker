import { redirect } from "next/navigation";

export default function OtherStatesJobsPage() {
  redirect("/jobs?stateSet=other");
}
