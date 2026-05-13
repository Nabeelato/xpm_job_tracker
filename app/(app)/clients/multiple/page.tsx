import { ClientListPage } from "@/components/client-list-page";

export default function MultipleClientsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/multiple" presetFilter="multiple" searchParams={searchParams} title="Clients With Multiple Jobs" />;
}
