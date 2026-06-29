import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { bookkeepingByLabels, bookkeepingSoftwareLabels } from "@/lib/constants";

const bookkeepingSoftwareOptions = Object.entries(bookkeepingSoftwareLabels);
const bookkeepingByOptions = Object.entries(bookkeepingByLabels);

export function ClientFilters({ params }: { params: URLSearchParams }) {
  return (
    <form className="mb-4 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      {params.get("pageSize") ? <input name="pageSize" type="hidden" value={params.get("pageSize") ?? ""} /> : null}
      <div className="relative md:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" defaultValue={params.get("q") ?? ""} name="q" placeholder="Search client name" />
      </div>
      <Select defaultValue={params.get("filter") ?? ""} name="filter">
        <option value="">All clients</option>
        <optgroup label="Category">
          <option value="category_software">Software Client</option>
          <option value="category_manual">Manual Client</option>
          <option value="category_uncategorized">Uncategorized</option>
        </optgroup>
        <optgroup label="By department">
          <option value="vat">VAT jobs</option>
          <option value="software_bk">Software Bookkeeping jobs</option>
          <option value="bk">BK jobs</option>
          <option value="afs">AFS jobs</option>
          <option value="vat_bk">VAT + BK jobs</option>
          <option value="vat_afs">VAT + AFS jobs</option>
          <option value="bk_afs">BK + AFS jobs</option>
          <option value="all_3">All 3 departments</option>
          <option value="unclassified">Unclassified jobs</option>
        </optgroup>
        <optgroup label="Other">
          <option value="multiple">Multiple jobs</option>
          <option value="missing">Missing jobs</option>
        </optgroup>
      </Select>
      <Select defaultValue={params.get("bookkeepingSoftware") ?? ""} name="bookkeepingSoftware">
        <option value="">Any software</option>
        {bookkeepingSoftwareOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select defaultValue={params.get("bookkeepingBy") ?? ""} name="bookkeepingBy">
        <option value="">Bookkeeping by anyone</option>
        {bookkeepingByOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
