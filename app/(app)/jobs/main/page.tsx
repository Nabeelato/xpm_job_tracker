import { redirect } from "next/navigation";

export default function MainJobsPage() {
  redirect("/jobs?stateSet=main");
}
