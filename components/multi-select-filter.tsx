"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
};

export function MultiSelectFilter({
  className,
  emptyMessage = "No matches found.",
  compact = false,
  label,
  name,
  options,
  searchPlaceholder = "Search",
  selectedValues,
  searchable = true,
}: {
  className?: string;
  emptyMessage?: string;
  compact?: boolean;
  label: string;
  name: string;
  options: MultiSelectOption[];
  searchPlaceholder?: string;
  selectedValues: string[];
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.meta ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, options]);

  const selectedCount = selectedSet.size;

  return (
    <fieldset
      className={cn(
        compact ? "space-y-3" : "rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm shadow-slate-900/5 backdrop-blur",
        className,
      )}
    >
      <legend className={cn(compact ? "sr-only" : "px-1 text-sm font-semibold text-slate-900")}>{label}</legend>

      <div className={cn("flex items-center justify-between gap-3 text-xs text-slate-500", compact ? "px-1" : "mt-2 px-1")}>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : "None selected"}</span>
        {searchable ? <span>Search to narrow the list</span> : null}
      </div>

      {searchable ? (
        <div className={cn("relative", compact ? "" : "mt-2")}>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
        </div>
      ) : null}

      <div className={cn(compact ? "space-y-1" : "mt-3 max-h-72 space-y-1 overflow-auto pr-1")}>
        {filteredOptions.length ? (
          filteredOptions.map((option) => (
            <label
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-100/80",
                option.disabled && "cursor-not-allowed opacity-60",
              )}
              key={option.value}
            >
              <input
                className="peer mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus-visible:ring-slate-400"
                defaultChecked={selectedSet.has(option.value)}
                disabled={option.disabled}
                name={name}
                type="checkbox"
                value={option.value}
              />
              <div className="min-w-0 flex-1 rounded-lg transition peer-checked:bg-slate-900/5">
                <div className="truncate text-sm font-medium text-slate-900">{option.label}</div>
                {option.meta ? <div className="truncate text-xs text-slate-500">{option.meta}</div> : null}
              </div>
            </label>
          ))
        ) : (
          <p className="px-2 py-4 text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </fieldset>
  );
}
