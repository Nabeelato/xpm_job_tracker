import { ClientListPage } from "@/components/client-list-page";

export default function ClientsWithAllThreePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/all-3" presetFilter="all_3" searchParams={searchParams} title="Clients With All 3 Departments" />;
}
