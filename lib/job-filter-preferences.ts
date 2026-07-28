export const defaultJobStateFilterValues = [
  "main",
  "workflow",
  "other",
  "completed",
  "cancelled",
  "state_1",
  "state_2",
  "state_3",
  "state_3_1",
  "state_3_2",
  "state_4",
  "state_5",
  "state_6",
  "state_7",
  "state_8",
  "state_9",
  "state_10",
  "state_11",
  "state_12",
] as const;

export type DefaultJobStateFilter = (typeof defaultJobStateFilterValues)[number];

export type DefaultJobFilters = {
  departments: string[];
  stateFilters: DefaultJobStateFilter[];
};

const allowedStateFilters = new Set<string>(defaultJobStateFilterValues);
const explicitAllJobsFilterKeys = [
  "q",
  "department",
  "staffUserId",
  "managerUserId",
  "supervisorUserId",
  "assignedUserId",
  "stateFilter",
  "stateSet",
  "stateGroup",
  "stateNumbers",
  "jobStateNumber",
  "clientCategory",
  "sortBy",
  "sortDir",
  "priority",
  "sourceManager",
  "sourcePartner",
  "xpmSubState",
  "missing",
  "archived",
] as const;

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)),
  );
}

export function parseDefaultJobFilters(value: unknown): DefaultJobFilters | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const stored = value as { departments?: unknown; stateFilters?: unknown };
  const departments = uniqueStrings(stored.departments);
  const stateFilters = uniqueStrings(stored.stateFilters).filter(
    (state): state is DefaultJobStateFilter => allowedStateFilters.has(state),
  );

  if (!departments.length && !stateFilters.length) return null;
  return { departments, stateFilters };
}

export function defaultJobFiltersFromForm(formData: FormData, allowedDepartments: Set<string>): DefaultJobFilters {
  const departments = uniqueStrings(formData.getAll("department")).filter((department) => allowedDepartments.has(department));
  const stateFilters = uniqueStrings(formData.getAll("stateFilter")).filter(
    (state): state is DefaultJobStateFilter => allowedStateFilters.has(state),
  );
  return { departments, stateFilters };
}

export function hasExplicitAllJobsFilters(params: URLSearchParams) {
  return explicitAllJobsFilterKeys.some((key) => params.has(key));
}

export function applyDefaultJobFilters(params: URLSearchParams, defaults: DefaultJobFilters) {
  for (const department of defaults.departments) params.append("department", department);
  for (const stateFilter of defaults.stateFilters) params.append("stateFilter", stateFilter);
}
