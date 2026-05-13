import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: URLSearchParams;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const previous = new URLSearchParams(params);
  previous.set("page", String(Math.max(1, page - 1)));
  const next = new URLSearchParams(params);
  next.set("page", String(Math.min(lastPage, page + 1)));

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <div>
        Page {page} of {lastPage} · {total} records
      </div>
      <div className="flex gap-2">
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")} href={`${basePath}?${previous}`}>
          Previous
        </Link>
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= lastPage && "pointer-events-none opacity-50")} href={`${basePath}?${next}`}>
          Next
        </Link>
      </div>
    </div>
  );
}
