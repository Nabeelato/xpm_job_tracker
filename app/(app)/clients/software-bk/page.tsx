import { ClientListPage } from "@/components/client-list-page";

export default function SoftwareBkClientsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/software-bk" presetFilter="software_bk" searchParams={searchParams} title="Clients With Software Bookkeeping Jobs" />;
}
