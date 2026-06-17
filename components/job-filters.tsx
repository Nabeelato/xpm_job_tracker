import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { jobStateOptions } from "@/lib/constants";

export function JobFilters({
  hidden = {},
  params,
  departments,
  users,
  preserveParams = {},
}: {
  hidden?: {
    assignedUserId?: boolean;
    department?: boolean;
    jobStateNumber?: boolean;
  };
  params: URLSearchParams;
  departments: Array<{ id: string; code: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  preserveParams?: Record<string, string>;
}) {
  return (
    <form className="mb-4 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      {Object.entries(preserveParams).map(([k, v]) => (
        <input key={k} name={k} type="hidden" value={v} />
      ))}
      {hidden.department && params.get("department") ? <input name="department" type="hidden" value={params.get("department") ?? ""} /> : null}
      {hidden.jobStateNumber && params.get("jobStateNumber") ? <input name="jobStateNumber" type="hidden" value={params.get("jobStateNumber") ?? ""} /> : null}
      {hidden.assignedUserId && params.get("assignedUserId") ? <input name="assignedUserId" type="hidden" value={params.get("assignedUserId") ?? ""} /> : null}
      {params.get("stateSet") ? <input name="stateSet" type="hidden" value={params.get("stateSet") ?? ""} /> : null}
      <div className="relative md:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" defaultValue={params.get("q") ?? ""} name="q" placeholder="Job no, client, or job name" />
      </div>
      {hidden.department ? null : (
        <Select defaultValue={params.get("department") ?? ""} name="department">
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.code}>
              {department.name}
            </option>
          ))}
        </Select>
      )}
      {hidden.jobStateNumber ? null : (
        <Select defaultValue={params.get("jobStateNumber") ?? ""} name="jobStateNumber">
          <option value="">Any job state</option>
          {jobStateOptions.map((state) => (
            <option key={state.code} value={String(state.number)}>
              {state.label}
            </option>
          ))}
        </Select>
      )}
      <Input defaultValue={params.get("priority") ?? ""} name="priority" placeholder="Priority" />
      {hidden.assignedUserId ? null : (
        <Select defaultValue={params.get("assignedUserId") ?? ""} name="assignedUserId">
          <option value="">Any assignee</option>
          <option value="unassigned">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      )}
      <Input defaultValue={params.get("sourceManager") ?? ""} name="sourceManager" placeholder="Source manager" />
      <Input defaultValue={params.get("sourcePartner") ?? ""} name="sourcePartner" placeholder="Source partner" />
      <Select defaultValue={params.get("xpmSubState") ?? ""} name="xpmSubState">
        <option value="">All job sub-states</option>
        <option value="ifza_check">IFZA Check (3.2)</option>
        <option value="job_on_hold">Job On Hold (3.1)</option>
      </Select>
      <Select defaultValue={params.get("missing") ?? ""} name="missing">
        <option value="">Missing: any</option>
        <option value="true">Missing latest</option>
        <option value="false">Seen latest</option>
      </Select>
      <Select defaultValue={params.get("archived") ?? "false"} name="archived">
        <option value="false">Active only</option>
        <option value="">Active and archived</option>
        <option value="true">Archived only</option>
      </Select>
      {params.get("sortBy") ? <input name="sortBy" type="hidden" value={params.get("sortBy") ?? ""} /> : null}
      {params.get("sortDir") ? <input name="sortDir" type="hidden" value={params.get("sortDir") ?? ""} /> : null}
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
