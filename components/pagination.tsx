import { buttonVariants } from "@/components/ui/button";
import { type PageSizeOption, cn, withPageSizeParam } from "@/lib/utils";

const pageSizeOptions: Array<{ label: string; value: PageSizeOption }> = [
  { label: "25", value: "25" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
  { label: "All (max 500)", value: "all" },
];

function pageSizeHref(basePath: string, params: URLSearchParams, value: PageSizeOption) {
  const next = withPageSizeParam(params, value);
  next.delete("page");

  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  page,
  pageSize,
  pageSizeOption = "25",
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  pageSizeOption?: PageSizeOption;
  total: number;
  basePath: string;
  params: URLSearchParams;
}) {
  const isAllMode = pageSizeOption === "all";
  const currentPage = isAllMode ? 1 : page;
  const lastPage = isAllMode ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const previous = new URLSearchParams(params);
  previous.set("page", String(Math.max(1, currentPage - 1)));
  const next = new URLSearchParams(params);
  next.set("page", String(Math.min(lastPage, currentPage + 1)));

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span>
          Page {currentPage} of {lastPage} - {total} records
        </span>
        {isAllMode && total > pageSize ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            All is capped at {pageSize} records
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1">Rows:</span>
          {pageSizeOptions.map((option) => (
            <a
              aria-current={pageSizeOption === option.value ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: pageSizeOption === option.value ? "default" : "outline", size: "sm" }),
                "h-7 px-2 text-xs",
              )}
              href={pageSizeHref(basePath, params, option.value)}
              key={option.value}
            >
              {option.label}
            </a>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <a
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            currentPage <= 1 && "pointer-events-none opacity-50",
          )}
          href={`${basePath}?${previous}`}
        >
          Previous
        </a>
        <a
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            currentPage >= lastPage && "pointer-events-none opacity-50",
          )}
          href={`${basePath}?${next}`}
        >
          Next
        </a>
      </div>
    </div>
  );
}
