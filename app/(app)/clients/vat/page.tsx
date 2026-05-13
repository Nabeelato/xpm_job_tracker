import { ClientListPage } from "@/components/client-list-page";

export default function ClientsWithVatPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ClientListPage basePath="/clients/vat" presetFilter="vat" searchParams={searchParams} title="Clients With VAT Jobs" />;
}
