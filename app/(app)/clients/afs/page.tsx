import { ClientListPage } from "@/components/client-list-page";

export default function ClientsWithAfsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/afs" presetFilter="afs" searchParams={searchParams} title="Clients With AFS Jobs" />;
}
