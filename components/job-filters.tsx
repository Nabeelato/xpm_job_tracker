import Link from "next/link";
import type { ReactNode } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { clientCategories, clientCategoryLabels, jobStateOptions } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type JobTabsConfig = {
  assignees?: boolean;
  departments?: boolean;
  stateSets?: boolean;
  states?: "all" | readonly number[];
};

const sortOptions = [
  { value: "", label: "Default" },
  { value: "jobNo", label: "Job no." },
  { value: "client", label: "Client" },
  { value: "jobName", label: "Job name" },
  { value: "department", label: "Department" },
  { value: "state", label: "Source state" },
] as const;

const sortLabels = new Map<string, string>(sortOptions.map((option) => [option.value, option.label]));
const stateSetLabels = new Map([
  ["main", "Main 02-06"],
  ["workflow", "Workflow 03-06"],
  ["other", "Other states"],
]);
const xpmSubStateLabels = new Map([
  ["ifza_check", "IFZA Check (3.2)"],
  ["job_on_hold", "Job On Hold (3.1)"],
]);
const missingLabels = new Map([
  ["true", "Missing latest"],
  ["false", "Seen latest"],
]);
const archivedLabels = new Map([
  ["", "Active and archived"],
  ["true", "Archived only"],
]);

function clientCategoryLabel(value: string) {
  if (value === "SOFTWARE" || value === "category_software") return clientCategoryLabels.SOFTWARE;
  if (value === "MANUAL" || value === "category_manual") return clientCategoryLabels.MANUAL;
  if (value === "uncategorized" || value === "category_uncategorized") return "Uncategorized";
  return value;
}

function cleanHref(basePath: string, params: URLSearchParams) {
  for (const [key, value] of Array.from(params.entries())) {
    if (!value) params.delete(key);
  }
  params.delete("page");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function removeHref(basePath: string, params: URLSearchParams, keys: string[]) {
  const next = new URLSearchParams(params);
  for (const key of keys) next.delete(key);
  return cleanHref(basePath, next);
}

function stateFilterValue(params: URLSearchParams) {
  const stateFilter = params.get("stateFilter");
  if (stateFilter) return stateFilter;

  const jobStateNumber = params.get("jobStateNumber");
  if (jobStateNumber) {
    const parsed = Number.parseInt(jobStateNumber, 10);
    if (Number.isFinite(parsed)) return String(parsed);
  }

  const stateSet = params.get("stateSet");
  if (stateSet === "main" || stateSet === "workflow" || stateSet === "other") return stateSet;

  const stateGroup = params.get("stateGroup");
  if (stateGroup === "MAIN") return "main";
  if (stateGroup === "OTHER") return "other";
  if (stateGroup === "COMPLETED") return "11";
  if (stateGroup === "CANCELLED") return "12";

  const stateNumbers = params.get("stateNumbers");
  if (stateNumbers === "2,3,4,5,6") return "main";
  if (stateNumbers === "3,4,5,6") return "workflow";

  return "";
}

function stateLabel(value: string) {
  if (!value || value === "all") return "All states";
  const setLabel = stateSetLabels.get(value);
  if (setLabel) return setLabel;
  const state = jobStateOptions.find((option) => String(option.number) === value);
  return state?.label ?? value;
}

function visibleStateOptions(config?: JobTabsConfig) {
  const allowedStates = Array.isArray(config?.states) ? new Set<number>(config.states) : null;
  const states =
    allowedStates && config?.states !== "all"
      ? jobStateOptions.filter((state) => allowedStates.has(state.number))
      : jobStateOptions;
  const includeStateSets = Boolean(config?.stateSets || config?.states === "all" || !config?.states);

  return { states, includeStateSets };
}

function Field({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1 text-xs font-medium text-muted-foreground", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function JobFilters({
  activeParams,
  basePath,
  config,
  departments,
  hasPresetState = false,
  lockedMissing = false,
  params,
  users,
}: {
  activeParams?: URLSearchParams;
  basePath: string;
  config?: JobTabsConfig;
  departments: Array<{ id: string; code: string; name: string }>;
  hasPresetState?: boolean;
  lockedMissing?: boolean;
  params: URLSearchParams;
  users: Array<{ id: string; name: string | null }>;
}) {
  const pillParams = activeParams ?? params;
  const { includeStateSets, states } = visibleStateOptions(config);
  const selectedStateFilter = stateFilterValue(params);
  const rawStateFilter = stateFilterValue(pillParams);
  const departmentByCode = new Map(departments.map((department) => [department.code, department.name]));
  const userById = new Map(users.map((user) => [user.id, user.name ?? "Unnamed user"]));
  const hasAdvancedFilters = Boolean(
    params.get("priority") ||
      params.get("sourceManager") ||
      params.get("sourcePartner") ||
      params.get("xpmSubState") ||
      (!lockedMissing && params.get("missing")) ||
      (params.get("archived") && params.get("archived") !== "false"),
  );

  const activeFilters: Array<{ href: string; label: string }> = [];
  const addFilter = (label: string, keys: string[]) => {
    activeFilters.push({ href: removeHref(basePath, pillParams, keys), label });
  };

  const query = pillParams.get("q")?.trim();
  if (query) addFilter(`Search: ${query}`, ["q"]);

  const department = pillParams.get("department");
  if (department) addFilter(`Department: ${departmentByCode.get(department) ?? department}`, ["department"]);

  const clientCategory = pillParams.get("clientCategory");
  if (clientCategory) addFilter(`Client category: ${clientCategoryLabel(clientCategory)}`, ["clientCategory"]);

  if (rawStateFilter) {
    addFilter("State: " + stateLabel(rawStateFilter), [
      "stateFilter",
      "jobStateNumber",
      "stateSet",
      "stateGroup",
      "stateNumbers",
    ]);
  }

  const assignee = pillParams.get("assignedUserId");
  if (assignee === "unassigned") {
    addFilter("Assignee: Unassigned", ["assignedUserId"]);
  } else if (assignee) {
    addFilter(`Assignee: ${userById.get(assignee) ?? "Unknown user"}`, ["assignedUserId"]);
  }

  const priority = pillParams.get("priority")?.trim();
  if (priority) addFilter(`Priority: ${priority}`, ["priority"]);

  const sourceManager = pillParams.get("sourceManager")?.trim();
  if (sourceManager) addFilter(`Manager: ${sourceManager}`, ["sourceManager"]);

  const sourcePartner = pillParams.get("sourcePartner")?.trim();
  if (sourcePartner) addFilter(`Partner: ${sourcePartner}`, ["sourcePartner"]);

  const xpmSubState = pillParams.get("xpmSubState");
  if (xpmSubState) addFilter(`Sub-state: ${xpmSubStateLabels.get(xpmSubState) ?? xpmSubState}`, ["xpmSubState"]);

  const missing = pillParams.get("missing");
  if (!lockedMissing && missing) addFilter(missingLabels.get(missing) ?? `Missing: ${missing}`, ["missing"]);

  const archived = pillParams.get("archived");
  if (archived && archived !== "false") {
    addFilter(archivedLabels.get(archived) ?? `Archived: ${archived}`, ["archived"]);
  }

  return (
    <form action={basePath} className="mb-4 space-y-3 rounded-lg border bg-white p-4">
      {params.get("pageSize") ? <input name="pageSize" type="hidden" value={params.get("pageSize") ?? ""} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_repeat(6,minmax(8rem,1fr))_minmax(10rem,auto)]">
        <Field className="md:col-span-2 xl:col-span-1" label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              defaultValue={params.get("q") ?? ""}
              name="q"
              placeholder="Job no, client, or job name"
            />
          </div>
        </Field>

        <Field label="Department">
          <Select defaultValue={params.get("department") ?? ""} name="department">
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.code}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Client category">
          <Select defaultValue={params.get("clientCategory") ?? ""} name="clientCategory">
            <option value="">Any category</option>
            {clientCategories.map((category) => (
              <option key={category} value={category}>
                {clientCategoryLabels[category]}
              </option>
            ))}
            <option value="uncategorized">Uncategorized</option>
          </Select>
        </Field>

        <Field label="State">
          <Select defaultValue={selectedStateFilter} name="stateFilter">
            <option value="">{hasPresetState ? "Page default states" : "All states"}</option>
            {hasPresetState && !Array.isArray(config?.states) ? <option value="all">All states</option> : null}
            {includeStateSets ? (
              <optgroup label="State sets">
                <option value="main">Main 02-06</option>
                <option value="workflow">Workflow 03-06</option>
                <option value="other">Other</option>
              </optgroup>
            ) : null}
            <optgroup label="Job states">
              {states.map((state) => (
                <option key={state.code} value={String(state.number)}>
                  {state.label}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>

        <Field label="Assignee">
          <Select defaultValue={params.get("assignedUserId") ?? ""} name="assignedUserId">
            <option value="">Any assignee</option>
            <option value="unassigned">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? "Unnamed user"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sort by">
          <Select defaultValue={params.get("sortBy") ?? ""} name="sortBy">
            {sortOptions.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Direction">
          <Select defaultValue={params.get("sortDir") ?? "asc"} name="sortDir">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </Select>
        </Field>

        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
          <Button className="flex-1" type="submit">
            Apply
          </Button>
          <Link className={cn(buttonVariants({ variant: "outline" }), "flex-1")} href={basePath}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Link>
        </div>
      </div>

      <details className="rounded-md border bg-muted/20 px-3 py-2" open={hasAdvancedFilters || undefined}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          Advanced filters
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Priority">
            <Input defaultValue={params.get("priority") ?? ""} name="priority" placeholder="Priority" />
          </Field>
          <Field label="Source manager">
            <Input defaultValue={params.get("sourceManager") ?? ""} name="sourceManager" placeholder="Source manager" />
          </Field>
          <Field label="Source partner">
            <Input defaultValue={params.get("sourcePartner") ?? ""} name="sourcePartner" placeholder="Source partner" />
          </Field>
          <Field label="Job sub-state">
            <Select defaultValue={params.get("xpmSubState") ?? ""} name="xpmSubState">
              <option value="">All job sub-states</option>
              <option value="ifza_check">IFZA Check (3.2)</option>
              <option value="job_on_hold">Job On Hold (3.1)</option>
            </Select>
          </Field>
          {lockedMissing ? null : (
            <Field label="Latest import">
              <Select defaultValue={params.get("missing") ?? ""} name="missing">
                <option value="">Missing: any</option>
                <option value="true">Missing latest</option>
                <option value="false">Seen latest</option>
              </Select>
            </Field>
          )}
          <Field label="Archive">
            <Select defaultValue={params.get("archived") ?? "false"} name="archived">
              <option value="false">Active only</option>
              <option value="">Active and archived</option>
              <option value="true">Archived only</option>
            </Select>
          </Field>
        </div>
      </details>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Link
              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              href={filter.href}
              key={filter.label}
            >
              <span className="truncate">{filter.label}</span>
              <X className="h-3.5 w-3.5 shrink-0" />
            </Link>
          ))}
          <span className="text-xs text-muted-foreground">
            Sort: {sortLabels.get(params.get("sortBy") ?? "") ?? "Default"} /{" "}
            {(params.get("sortDir") ?? "asc") === "desc" ? "Descending" : "Ascending"}
          </span>
        </div>
      ) : null}
    </form>
  );
}
