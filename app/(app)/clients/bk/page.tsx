import { ClientListPage } from "@/components/client-list-page";

export default function ClientsWithBkPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/bk" presetFilter="bk" searchParams={searchParams} title="Clients With BK Jobs" />;
}
