import { redirect } from "next/navigation";

export default function IfzaCheckJobsPage() {
  redirect("/jobs?xpmSubState=ifza_check");
}
