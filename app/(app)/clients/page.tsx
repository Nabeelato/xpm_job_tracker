import { ClientListPage } from "@/components/client-list-page";

export default function ClientsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients" description="Clients are matched by normalized names to prevent duplicates across daily uploads." searchParams={searchParams} title="All Clients" />;
}
