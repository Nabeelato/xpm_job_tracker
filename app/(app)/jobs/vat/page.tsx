import { redirect } from "next/navigation";

export default function VatJobsPage() {
  redirect("/jobs?department=VAT&stateSet=workflow");
}
