"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { MultiSelectFilter, type MultiSelectOption } from "@/components/multi-select-filter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { clientCategoryLabels } from "@/lib/constants";
import { cn, titleCaseEnum } from "@/lib/utils";

export type JobTabsConfig = {
  assignees?: boolean;
  departments?: boolean;
  stateSets?: boolean;
  states?: "all" | readonly number[];
};

type StateFilterValue = "main" | "workflow" | "other" | "completed" | "cancelled";

type FilterSection = "staff" | "manager" | "supervisor" | "department" | "state" | "client" | "more";

const sortOptions = [
  { value: "", label: "Default" },
  { value: "jobNo", label: "Job no." },
  { value: "client", label: "Client" },
  { value: "jobName", label: "Job name" },
  { value: "department", label: "Department" },
  { value: "state", label: "Source state" },
] as const;

const sortLabels = new Map<string, string>(sortOptions.map((option) => [option.value, option.label]));

const missingLabels = new Map([
  ["true", "Missing latest"],
  ["false", "Seen latest"],
]);

const archivedLabels = new Map([
  ["", "Active and archived"],
  ["true", "Archived only"],
]);

const stateFilterOptions = [
  { value: "main", label: "Main 02-06", meta: "States 02, 03, 04, 05, 06" },
  { value: "workflow", label: "Workflow 03-06", meta: "States 03, 04, 05, 06" },
  { value: "other", label: "Other states", meta: "States 01, 07, 08, 09, 10" },
  { value: "completed", label: "Completed", meta: "State 11" },
  { value: "cancelled", label: "Cancelled", meta: "State 12" },
] as const satisfies readonly MultiSelectOption[];

const stateFilterLabels = new Map<StateFilterValue, string>(
  stateFilterOptions.map((option) => [option.value, option.label]),
);

function isManagerLevelRole(role: string | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}

function clientCategoryLabel(value: string) {
  if (value === "SOFTWARE" || value === "category_software") return clientCategoryLabels.SOFTWARE;
  if (value === "MANUAL" || value === "category_manual") return clientCategoryLabels.MANUAL;
  if (value === "uncategorized" || value === "category_uncategorized") return "Uncategorized";
  return value;
}

function normalizeClientCategoryValue(value: string) {
  if (value === "category_software") return "SOFTWARE";
  if (value === "category_manual") return "MANUAL";
  if (value === "category_uncategorized") return "uncategorized";
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

function removeValueHref(basePath: string, params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams();
  for (const [currentKey, currentValue] of params.entries()) {
    if (currentKey === key && currentValue === value) continue;
    next.append(currentKey, currentValue);
  }
  return cleanHref(basePath, next);
}

function removeStateFilterHref(basePath: string, params: URLSearchParams, value: StateFilterValue) {
  const explicitStateFilters = getValues(params, "stateFilter").filter(isStateFilterValue);
  if (explicitStateFilters.length) {
    return removeValueHref(basePath, params, "stateFilter", value);
  }

  return removeHref(basePath, params, ["stateFilter", "stateSet", "stateGroup", "jobStateNumber", "stateNumbers"]);
}

function getValues(params: URLSearchParams, key: string) {
  return Array.from(
    new Set(
      params
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function parseNumbers(values: string[]) {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function isStateFilterValue(value: string): value is StateFilterValue {
  return stateFilterLabels.has(value as StateFilterValue);
}

function selectedStateFilters(params: URLSearchParams): StateFilterValue[] {
  const explicit = getValues(params, "stateFilter").filter(isStateFilterValue);
  if (explicit.length) return explicit;

  const stateGroup = params.get("stateGroup");
  if (stateGroup === "MAIN") return ["main"];
  if (stateGroup === "OTHER") return ["other"];
  if (stateGroup === "COMPLETED") return ["completed"];
  if (stateGroup === "CANCELLED") return ["cancelled"];

  const stateSet = params.get("stateSet");
  if (stateSet === "main" || stateSet === "workflow" || stateSet === "other") return [stateSet];

  const numbers = parseNumbers([...params.getAll("jobStateNumber"), ...params.getAll("stateNumbers")]);
  if (!numbers.length) return [];

  const next = new Set<string>();
  if (numbers.includes(2)) next.add("main");
  if (numbers.some((number) => number >= 3 && number <= 6)) next.add("workflow");
  if (numbers.some((number) => number === 1 || (number >= 7 && number <= 10))) next.add("other");
  if (numbers.includes(11)) next.add("completed");
  if (numbers.includes(12)) next.add("cancelled");

  return Array.from(next).filter(isStateFilterValue);
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
    <label className={cn("grid min-w-0 gap-1 text-xs font-medium text-slate-500", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function HiddenValues({
  name,
  values,
}: {
  name: string;
  values: string[];
}) {
  if (!values.length) return null;

  return (
    <>
      {values.map((value, index) => (
        <input key={`${name}-${index}-${value}`} name={name} type="hidden" value={value} />
      ))}
    </>
  );
}

function SectionButton({
  active,
  count,
  description,
  onClick,
  title,
}: {
  active?: boolean;
  count?: number;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={cn(
        "group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-slate-300 bg-slate-50 shadow-sm shadow-slate-900/5"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-semibold text-slate-950">{title}</div>
        <div className="truncate text-xs text-slate-500">{description}</div>
      </div>
      <div className="ml-4 flex items-center gap-3">
        {typeof count === "number" && count > 0 ? (
          <span className="inline-flex min-w-7 justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {count}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function SectionHeader({
  onBack,
  title,
  subtitle,
}: {
  onBack: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-4">
      <button
        aria-label="Back to filter categories"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Filters</div>
        <div className="truncate text-lg font-semibold text-slate-950">{title}</div>
        <div className="truncate text-xs text-slate-500">{subtitle}</div>
      </div>
    </header>
  );
}

function DrawerFooter({
  clearHref,
  onClose,
  onSubmitLabel = "Apply filters",
}: {
  clearHref: string;
  onClose: () => void;
  onSubmitLabel?: string;
}) {
  return (
    <footer className="border-t border-slate-200/80 bg-white/95 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <Link className={cn(buttonVariants({ variant: "outline" }), "flex-1 justify-center")} href={clearHref}>
          Clear filters
        </Link>
        <Button className="flex-1" onClick={onClose} type="button" variant="ghost">
          Done
        </Button>
        <Button className="flex-1" type="submit">
          {onSubmitLabel}
        </Button>
      </div>
    </footer>
  );
}

function MoreFilters({
  archived,
  hasLockedMissing,
  params,
}: {
  archived: string;
  hasLockedMissing: boolean;
  params: URLSearchParams;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Sort by">
        <Select
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none focus:ring-slate-300"
          defaultValue={params.get("sortBy") ?? ""}
          name="sortBy"
        >
          {sortOptions.map((option) => (
            <option key={option.value || "default"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Direction">
        <Select
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none focus:ring-slate-300"
          defaultValue={params.get("sortDir") ?? "asc"}
          name="sortDir"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </Select>
      </Field>
      <Field label="Priority">
        <Input
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
          defaultValue={params.get("priority") ?? ""}
          name="priority"
          placeholder="Priority"
        />
      </Field>
      <Field label="Source manager">
        <Input
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
          defaultValue={params.get("sourceManager") ?? ""}
          name="sourceManager"
          placeholder="Source manager"
        />
      </Field>
      <Field label="Source partner">
        <Input
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
          defaultValue={params.get("sourcePartner") ?? ""}
          name="sourcePartner"
          placeholder="Source partner"
        />
      </Field>
      <Field label="Job sub-state">
        <Select
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none focus:ring-slate-300"
          defaultValue={params.get("xpmSubState") ?? ""}
          name="xpmSubState"
        >
          <option value="">All job sub-states</option>
          <option value="ifza_check">IFZA Check (3.2)</option>
          <option value="job_on_hold">Job On Hold (3.1)</option>
        </Select>
      </Field>
      {hasLockedMissing ? (
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Latest import is locked for this page.
        </div>
      ) : (
        <Field label="Latest import">
          <Select
            className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none focus:ring-slate-300"
            defaultValue={params.get("missing") ?? ""}
            name="missing"
          >
            <option value="">Missing: any</option>
            <option value="true">Missing latest</option>
            <option value="false">Seen latest</option>
          </Select>
        </Field>
      )}
      <Field label="Archive">
        <Select
          className="h-10 rounded-xl border-slate-200 bg-slate-50 shadow-none focus:ring-slate-300"
          defaultValue={archived}
          name="archived"
        >
          <option value="false">Active only</option>
          <option value="">Active and archived</option>
          <option value="true">Archived only</option>
        </Select>
      </Field>
    </div>
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
  activeParams?: string;
  basePath: string;
  config?: JobTabsConfig;
  departments: Array<{ id: string; code: string; name: string }>;
  hasPresetState?: boolean;
  lockedMissing?: boolean;
  params: string;
  users: Array<{ id: string; name: string | null; role?: string }>;
}) {
  const searchParams = useMemo(() => new URLSearchParams(params), [params]);
  const pillParams = useMemo(() => new URLSearchParams(activeParams ?? params), [activeParams, params]);
  const paramsKey = params;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<FilterSection | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setActiveSection(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
    setActiveSection(null);
  }, [paramsKey]);

  const departmentByCode = useMemo(
    () => new Map(departments.map((department) => [department.code, department.name])),
    [departments],
  );
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name ?? "Unnamed user"])),
    [users],
  );

  const staffUsers = useMemo(
    () => users.filter((user) => user.role === "STAFF"),
    [users],
  );
  const managerUsers = useMemo(
    () => users.filter((user) => isManagerLevelRole(user.role)),
    [users],
  );
  const supervisorUsers = useMemo(
    () => users.filter((user) => user.role === "SUPERVISOR"),
    [users],
  );

  const departmentOptions = useMemo(
    () =>
      departments.map((department) => ({
        value: department.code,
        label: department.name,
        meta: department.code,
      })),
    [departments],
  );
  const staffOptions = useMemo(
    () => [
      { value: "unassigned", label: "Unassigned", meta: "No active staff assignment" },
      ...staffUsers.map((user) => ({
        value: user.id,
        label: user.name ?? "Unnamed user",
        meta: user.role ? titleCaseEnum(user.role) : undefined,
      })),
    ],
    [staffUsers],
  );
  const managerOptions = useMemo(
    () => [
      { value: "unassigned", label: "Unassigned", meta: "No active manager assignment" },
      ...managerUsers.map((user) => ({
        value: user.id,
        label: user.name ?? "Unnamed user",
        meta: user.role ? titleCaseEnum(user.role) : undefined,
      })),
    ],
    [managerUsers],
  );
  const supervisorOptions = useMemo(
    () => [
      { value: "unassigned", label: "Unassigned", meta: "No active supervisor assignment" },
      ...supervisorUsers.map((user) => ({
        value: user.id,
        label: user.name ?? "Unnamed user",
        meta: user.role ? titleCaseEnum(user.role) : undefined,
      })),
    ],
    [supervisorUsers],
  );
  const clientCategoryOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "SOFTWARE", label: clientCategoryLabels.SOFTWARE },
      { value: "MANUAL", label: clientCategoryLabels.MANUAL },
      { value: "uncategorized", label: "Uncategorized", meta: "No category set" },
    ],
    [],
  );

  const query = getValues(pillParams, "q")[0] ?? "";
  const stateFilters = selectedStateFilters(searchParams);
  const activeStateFilters = selectedStateFilters(pillParams);
  const activeFilters: Array<{ href: string; label: string }> = [];
  const addFilter = (label: string, keys: string[]) => {
    activeFilters.push({ href: removeHref(basePath, pillParams, keys), label });
  };
  const addValueFilter = (label: string, key: string, value: string) => {
    activeFilters.push({ href: removeValueHref(basePath, pillParams, key, value), label });
  };

  if (query) addFilter(`Search: ${query}`, ["q"]);

  for (const department of getValues(pillParams, "department")) {
    addValueFilter(`Department: ${departmentByCode.get(department) ?? department}`, "department", department);
  }

  for (const staff of getValues(pillParams, "staffUserId")) {
    if (staff === "unassigned") addValueFilter("Staff: Unassigned", "staffUserId", staff);
    else addValueFilter(`Staff: ${userById.get(staff) ?? "Unknown user"}`, "staffUserId", staff);
  }

  for (const manager of getValues(pillParams, "managerUserId")) {
    if (manager === "unassigned") addValueFilter("Manager: Unassigned", "managerUserId", manager);
    else addValueFilter(`Manager: ${userById.get(manager) ?? "Unknown user"}`, "managerUserId", manager);
  }

  for (const supervisor of getValues(pillParams, "supervisorUserId")) {
    if (supervisor === "unassigned") addValueFilter("Supervisor: Unassigned", "supervisorUserId", supervisor);
    else addValueFilter(`Supervisor: ${userById.get(supervisor) ?? "Unknown user"}`, "supervisorUserId", supervisor);
  }

  for (const clientCategory of getValues(pillParams, "clientCategory")) {
    addValueFilter(`Client: ${clientCategoryLabel(clientCategory)}`, "clientCategory", clientCategory);
  }

  for (const stateFilter of activeStateFilters) {
    activeFilters.push({
      href: removeStateFilterHref(basePath, pillParams, stateFilter),
      label: `State: ${stateFilterLabels.get(stateFilter) ?? stateFilter}`,
    });
  }

  for (const assignee of getValues(pillParams, "assignedUserId")) {
    if (assignee === "unassigned") {
      addValueFilter("Assignee: Unassigned", "assignedUserId", assignee);
    } else {
      addValueFilter(`Assignee: ${userById.get(assignee) ?? "Unknown user"}`, "assignedUserId", assignee);
    }
  }

  const priority = getValues(pillParams, "priority")[0] ?? "";
  if (priority) addFilter(`Priority: ${priority}`, ["priority"]);

  const sourceManager = getValues(pillParams, "sourceManager")[0] ?? "";
  if (sourceManager) addFilter(`Manager: ${sourceManager}`, ["sourceManager"]);

  const sourcePartner = getValues(pillParams, "sourcePartner")[0] ?? "";
  if (sourcePartner) addFilter(`Partner: ${sourcePartner}`, ["sourcePartner"]);

  const xpmSubState = getValues(pillParams, "xpmSubState")[0] ?? "";
  if (xpmSubState) addFilter(`Sub-state: ${xpmSubState}`, ["xpmSubState"]);

  const missing = getValues(pillParams, "missing")[0] ?? "";
  if (!lockedMissing && missing) addFilter(missingLabels.get(missing) ?? `Missing: ${missing}`, ["missing"]);

  const archived = getValues(pillParams, "archived")[0] ?? "";
  if (archived && archived !== "false") {
    addFilter(archivedLabels.get(archived) ?? `Archived: ${archived}`, ["archived"]);
  }

  const sortBy = getValues(pillParams, "sortBy")[0] ?? "";
  const sortDir = getValues(pillParams, "sortDir")[0] ?? "asc";
  const currentSortLabel = sortLabels.get(sortBy) ?? "Default";

  const showAssignees = config?.assignees !== false;
  const showDepartments = config?.departments !== false;
  const showStates = config?.stateSets !== false;

  const sections: Array<{ key: FilterSection; title: string; description: string; count: number } | null> = [
    showAssignees
      ? { key: "staff", title: "Staff", description: "Staff assignees", count: getValues(pillParams, "staffUserId").length }
      : null,
    showAssignees
      ? { key: "manager", title: "Manager", description: "Manager assignees", count: getValues(pillParams, "managerUserId").length }
      : null,
    showAssignees
      ? {
          key: "supervisor",
          title: "Supervisor",
          description: "Supervisor assignees",
          count: getValues(pillParams, "supervisorUserId").length,
        }
      : null,
    showDepartments
      ? {
          key: "department",
          title: "Department",
          description: "Final department filters",
          count: getValues(pillParams, "department").length,
        }
      : null,
    showStates
      ? {
          key: "state",
          title: "State",
          description: "Workflow and completion states",
          count: activeStateFilters.length,
        }
      : null,
    {
      key: "client",
      title: "Client",
      description: "Client category filters",
      count: getValues(pillParams, "clientCategory").length,
    },
    {
      key: "more",
      title: "More",
      description: "Sort and advanced filters",
      count:
        Number(Boolean(sortBy)) +
        Number(Boolean(priority)) +
        Number(Boolean(sourceManager)) +
        Number(Boolean(sourcePartner)) +
        Number(Boolean(xpmSubState)) +
        Number(Boolean(missing)) +
        Number(Boolean(archived && archived !== "false")),
    },
  ];

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => {
    setDrawerOpen(false);
    setActiveSection(null);
  };

  function renderVisibleSection() {
    switch (activeSection) {
      case "staff":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No staff members matched that search."
            label="Staff"
            name="staffUserId"
            options={staffOptions}
            searchPlaceholder="Search staff"
            selectedValues={getValues(searchParams, "staffUserId")}
          />
        );
      case "manager":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No managers matched that search."
            label="Manager"
            name="managerUserId"
            options={managerOptions}
            searchPlaceholder="Search managers"
            selectedValues={getValues(searchParams, "managerUserId")}
          />
        );
      case "supervisor":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No supervisors matched that search."
            label="Supervisor"
            name="supervisorUserId"
            options={supervisorOptions}
            searchPlaceholder="Search supervisors"
            selectedValues={getValues(searchParams, "supervisorUserId")}
          />
        );
      case "department":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No departments matched that search."
            label="Department"
            name="department"
            options={departmentOptions}
            searchPlaceholder="Search departments"
            selectedValues={getValues(searchParams, "department")}
          />
        );
      case "state":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No states available."
            label="State"
            name="stateFilter"
            options={[...stateFilterOptions]}
            searchable={false}
            selectedValues={stateFilters}
          />
        );
      case "client":
        return (
          <MultiSelectFilter
            compact
            className="px-4 pb-4"
            emptyMessage="No client categories available."
            label="Client"
            name="clientCategory"
            options={clientCategoryOptions}
            searchable={false}
            selectedValues={getValues(searchParams, "clientCategory").map(normalizeClientCategoryValue)}
          />
        );
      case "more":
        return (
          <div className="px-4 pb-4">
            <MoreFilters
              archived={searchParams.get("archived") ?? "false"}
              hasLockedMissing={lockedMissing}
              params={searchParams}
            />
          </div>
        );
      default:
        return null;
    }
  }

  const hiddenLegacyAssigneeValues = getValues(searchParams, "assignedUserId");
  const hiddenMyJobs = searchParams.get("myJobs") ? [searchParams.get("myJobs") ?? ""] : [];
  const hiddenMissingValue = lockedMissing ? (searchParams.get("missing") ? [searchParams.get("missing") ?? ""] : []) : [];

  return (
    <form action={basePath} className="mb-4 space-y-3">
      {searchParams.get("pageSize") ? <input name="pageSize" type="hidden" value={searchParams.get("pageSize") ?? ""} /> : null}
      <HiddenValues name="assignedUserId" values={hiddenLegacyAssigneeValues} />
      <HiddenValues name="myJobs" values={hiddenMyJobs} />
      {showAssignees ? null : (
        <>
          <HiddenValues name="staffUserId" values={getValues(searchParams, "staffUserId")} />
          <HiddenValues name="managerUserId" values={getValues(searchParams, "managerUserId")} />
          <HiddenValues name="supervisorUserId" values={getValues(searchParams, "supervisorUserId")} />
        </>
      )}
      {showDepartments ? null : <HiddenValues name="department" values={getValues(searchParams, "department")} />}
      {showStates ? null : (
        <>
          <HiddenValues name="stateFilter" values={getValues(searchParams, "stateFilter")} />
          <HiddenValues name="stateSet" values={searchParams.get("stateSet") ? [searchParams.get("stateSet") ?? ""] : []} />
          <HiddenValues name="stateGroup" values={searchParams.get("stateGroup") ? [searchParams.get("stateGroup") ?? ""] : []} />
          <HiddenValues name="jobStateNumber" values={searchParams.get("jobStateNumber") ? [searchParams.get("jobStateNumber") ?? ""] : []} />
          <HiddenValues name="stateNumbers" values={getValues(searchParams, "stateNumbers")} />
        </>
      )}
      {lockedMissing ? <HiddenValues name="missing" values={hiddenMissingValue} /> : null}

      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.38)]">
        <div className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
              defaultValue={query}
              name="q"
              placeholder="Search job no, client, or job name"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {activeFilters.length > 0 ? (
              <Link className={cn(buttonVariants({ variant: "outline" }), "whitespace-nowrap")} href={basePath}>
                Clear filters
              </Link>
            ) : null}
            <Button
              aria-controls="job-filters-drawer"
              aria-expanded={drawerOpen}
              onClick={drawerOpen ? closeDrawer : openDrawer}
              type="button"
              variant="outline"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {activeFilters.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active filters</span>
              {activeFilters.map((filter) => (
                <Link
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  href={filter.href}
                  key={filter.label}
                >
                  <span className="truncate">{filter.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" />
                </Link>
              ))}
            </div>
            <div className="text-xs text-slate-500">
              Sort: {currentSortLabel} / {sortDir === "desc" ? "Descending" : "Ascending"}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-dashed border-slate-200/80 px-4 py-3 text-xs text-slate-500">
            <span>{hasPresetState ? "This page starts with preset job states." : "No filters applied yet."}</span>
            <span>Open Filters for stacked checklists.</span>
          </div>
        )}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
            onClick={closeDrawer}
            type="button"
          />

          <aside
            aria-label="Job filters"
            className="absolute inset-y-0 left-0 z-50 flex w-[min(100vw,26rem)] flex-col border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50 shadow-[0_28px_100px_-40px_rgba(15,23,42,0.4)]"
            id="job-filters-drawer"
            role="dialog"
          >
            {activeSection ? (
              <SectionHeader
                onBack={() => setActiveSection(null)}
                subtitle={
                  activeSection === "staff"
                    ? "Choose the staff assignees to match"
                    : activeSection === "manager"
                      ? "Choose the manager assignees to match"
                      : activeSection === "supervisor"
                        ? "Choose the supervisor assignees to match"
                        : activeSection === "department"
                          ? "Choose the departments to match"
                          : activeSection === "state"
                            ? "Choose the workflow states to match"
                            : activeSection === "client"
                              ? "Choose the client categories to match"
                              : "Tune the remaining filters"
                }
                title={
                  activeSection === "staff"
                    ? "Staff"
                    : activeSection === "manager"
                      ? "Manager"
                      : activeSection === "supervisor"
                        ? "Supervisor"
                        : activeSection === "department"
                          ? "Department"
                          : activeSection === "state"
                            ? "State"
                            : activeSection === "client"
                              ? "Client"
                              : "More filters"
                }
              />
            ) : (
              <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Filters</div>
                  <div className="text-lg font-semibold text-slate-950">Filter jobs by</div>
                </div>
                <button
                  aria-label="Close filters"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                  onClick={closeDrawer}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeSection ? (
                renderVisibleSection()
              ) : (
                <div className="space-y-3 px-4 py-4">
                  {(sections.filter(Boolean) as Array<{ key: FilterSection; title: string; description: string; count: number }>).map(
                    (section) => (
                      <SectionButton
                        active={activeSection === section.key}
                        count={section.count}
                        description={section.description}
                        key={section.key}
                        onClick={() => setActiveSection(section.key)}
                        title={section.title}
                      />
                    ),
                  )}
                </div>
              )}
            </div>

            {activeSection ? (
              <DrawerFooter clearHref={basePath} onClose={closeDrawer} />
            ) : (
              <footer className="border-t border-slate-200/80 bg-white/95 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">
                    {activeFilters.length > 0 ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"} selected` : "No filters selected"}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilters.length > 0 ? (
                      <Link className={cn(buttonVariants({ variant: "outline" }), "whitespace-nowrap")} href={basePath}>
                        Clear filters
                      </Link>
                    ) : null}
                    <Button onClick={closeDrawer} type="button" variant="ghost">
                      Done
                    </Button>
                  </div>
                </div>
              </footer>
            )}
          </aside>
        </div>
      ) : null}
    </form>
  );
}
