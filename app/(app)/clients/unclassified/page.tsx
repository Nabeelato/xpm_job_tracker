import { ClientListPage } from "@/components/client-list-page";

export default function ClientsWithUnclassifiedPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/unclassified" presetFilter="unclassified" searchParams={searchParams} title="Clients With Unclassified Jobs" />;
}
