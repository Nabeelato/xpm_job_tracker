import { buttonVariants } from "@/components/ui/button";
import { jobStateOptions } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type JobTabsConfig = {
  assignees?: boolean;
  departments?: boolean;
  stateSets?: boolean;
  states?: "all" | readonly number[];
};

type TabOption = {
  active: boolean;
  label: string;
  updates: Record<string, string | null>;
};

function tabHref(basePath: string, params: URLSearchParams, updates: Record<string, string | null>) {
  const nextParams = new URLSearchParams(params);
  nextParams.delete("page");
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  }

  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function TabGroup({
  basePath,
  label,
  options,
  params,
}: {
  basePath: string;
  label: string;
  options: TabOption[];
  params: URLSearchParams;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[9rem_1fr] md:items-start">
      <div className="pt-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => (
          <a
            aria-current={option.active ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: option.active ? "default" : "outline", size: "sm" }),
              "shrink-0",
            )}
            href={tabHref(basePath, params, option.updates)}
            key={`${label}-${option.label}`}
          >
            {option.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function JobFilterTabs({
  basePath,
  config,
  departments,
  params,
  users,
}: {
  basePath: string;
  config?: JobTabsConfig;
  departments: Array<{ id: string; code: string; name: string }>;
  params: URLSearchParams;
  users: Array<{ id: string; name: string }>;
}) {
  if (!config || (!config.departments && !config.states && !config.assignees && !config.stateSets)) return null;

  const department = params.get("department") ?? "";
  const jobStateNumber = params.get("jobStateNumber") ?? "";
  const stateSet = params.get("stateSet") ?? "";
  const assignedUserId = params.get("assignedUserId") ?? "";
  const allowedStates = Array.isArray(config.states) ? new Set<number>(config.states) : null;
  const stateTabs = config.states === "all" ? jobStateOptions : allowedStates ? jobStateOptions.filter((state) => allowedStates.has(state.number)) : [];

  return (
    <div className="mb-4 space-y-4 rounded-lg border bg-white p-3">
      {config.departments ? (
        <TabGroup
          basePath={basePath}
          label="Department"
          options={[
            { label: "All", active: department === "", updates: { department: null } },
            ...departments.map((item) => ({
              label: item.name,
              active: department === item.code,
              updates: { department: item.code },
            })),
          ]}
          params={params}
        />
      ) : null}

      {config.stateSets || config.states ? (
        <TabGroup
          basePath={basePath}
          label="State"
          options={[
            ...(config.stateSets
              ? [
                  {
                    label: "All",
                    active: jobStateNumber === "" && stateSet === "",
                    updates: { jobStateNumber: null, stateSet: null },
                  },
                  {
                    label: "Main 02-06",
                    active: stateSet === "main",
                    updates: { jobStateNumber: null, stateSet: "main" },
                  },
                  {
                    label: "Workflow 03-06",
                    active: stateSet === "workflow",
                    updates: { jobStateNumber: null, stateSet: "workflow" },
                  },
                  {
                    label: "Other",
                    active: stateSet === "other",
                    updates: { jobStateNumber: null, stateSet: "other" },
                  },
                ]
              : [{ label: "All", active: jobStateNumber === "", updates: { jobStateNumber: null } }]),
            ...stateTabs.map((state) => ({
              label: state.code,
              active: jobStateNumber === String(state.number),
              updates: { jobStateNumber: String(state.number), stateSet: null },
            })),
          ]}
          params={params}
        />
      ) : null}

      {config.assignees ? (
        <TabGroup
          basePath={basePath}
          label="Assignee"
          options={[
            { label: "All", active: assignedUserId === "", updates: { assignedUserId: null } },
            { label: "Unassigned", active: assignedUserId === "unassigned", updates: { assignedUserId: "unassigned" } },
            ...users.map((user) => ({
              label: user.name,
              active: assignedUserId === user.id,
              updates: { assignedUserId: user.id },
            })),
          ]}
          params={params}
        />
      ) : null}
    </div>
  );
}
