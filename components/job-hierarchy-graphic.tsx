import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, Clock3, Network, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatElapsedTime, titleCaseEnum } from "@/lib/utils";

export type HierarchyJob = {
  id: string;
  jobIdFromExcel: string;
  jobName: string;
  clientName: string;
  stateNumber: number | null;
  assignedAt: Date;
  workingSince: Date | null;
};

export type HierarchyPerson = {
  id: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "SUPERVISOR" | "STAFF";
  departmentCode: string | null;
  supervisorId: string | null;
  jobs: HierarchyJob[];
};

function JobRows({ jobs }: { jobs: HierarchyJob[] }) {
  if (!jobs.length) return <p className="mt-2 text-xs text-muted-foreground">No current assigned jobs.</p>;
  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-dashed bg-white/70 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white [&::-webkit-details-marker]:hidden">
        <span>{jobs.length} current assigned job{jobs.length === 1 ? "" : "s"}</span>
        <span className="flex items-center gap-1">
          Show jobs
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-2 space-y-1.5">
        {jobs.map((job) => (
          <Link
            className="grid gap-1 rounded-md border bg-white px-3 py-2 text-xs transition hover:border-primary/40 hover:bg-primary/5 sm:grid-cols-[1fr_auto]"
            href={`/jobs/${job.id}`}
            key={job.id}
          >
            <span>
              <span className="font-semibold text-foreground">{job.jobIdFromExcel} — {job.jobName}</span>
              <span className="mt-0.5 block text-muted-foreground">{job.clientName} · State {job.stateNumber ?? "—"}</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {job.workingSince ? `Working ${formatElapsedTime(job.workingSince)}` : `Assigned ${formatElapsedTime(job.assignedAt)}`}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}

function StaffNode({ person }: { person: HierarchyPerson }) {
  return (
    <div className="relative ml-5 border-l-2 border-emerald-200 pl-5 before:absolute before:left-0 before:top-5 before:w-5 before:-translate-x-full before:border-t-2 before:border-emerald-200">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <UserRound className="h-4 w-4 text-emerald-700" />
          <Link className="font-semibold text-emerald-950 hover:underline" href={`/team-status/${person.id}`}>
            {person.name}
          </Link>
          <Badge variant="success">Staff</Badge>
          <span className="text-xs text-muted-foreground">{person.departmentCode ?? "No department"}</span>
        </div>
        <JobRows jobs={person.jobs} />
      </div>
    </div>
  );
}

function SupervisorNode({ person, staff }: { person: HierarchyPerson; staff: HierarchyPerson[] }) {
  return (
    <div className="relative ml-5 border-l-2 border-violet-200 pl-5 before:absolute before:left-0 before:top-6 before:w-5 before:-translate-x-full before:border-t-2 before:border-violet-200">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <UsersRound className="h-4 w-4 text-violet-700" />
          <span className="font-semibold text-violet-950">{person.name}</span>
          <Badge className="border-violet-200 bg-violet-100 text-violet-800" variant="outline">Supervisor</Badge>
          <span className="text-xs text-muted-foreground">{person.departmentCode ?? "No department"}</span>
        </div>
        <JobRows jobs={person.jobs} />
        <div className="mt-3 space-y-3">
          {staff.length ? staff.map((member) => <StaffNode key={member.id} person={member} />) : (
            <p className="ml-5 rounded-md border border-dashed p-2 text-xs text-muted-foreground">No staff team — supervisor-owned jobs appear above.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobHierarchyGraphic({ people }: { people: HierarchyPerson[] }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const childrenOf = new Map<string, HierarchyPerson[]>();
  for (const person of people) {
    if (!person.supervisorId) continue;
    const children = childrenOf.get(person.supervisorId) ?? [];
    children.push(person);
    childrenOf.set(person.supervisorId, children);
  }

  const leaders = people.filter((person) => person.role === "ADMIN" || person.role === "MANAGER");
  const orphanSupervisors = people.filter(
    (person) => person.role === "SUPERVISOR" && (!person.supervisorId || !byId.has(person.supervisorId)),
  );

  if (!people.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No hierarchy users are visible.</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      {leaders.map((leader) => {
        const supervisors = (childrenOf.get(leader.id) ?? []).filter((person) => person.role === "SUPERVISOR");
        return (
          <Card className="overflow-hidden" key={leader.id}>
            <CardHeader className="border-b bg-sky-50/70">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Network className="h-5 w-5 text-sky-700" />
                {leader.name}
                <Badge variant="outline">{titleCaseEnum(leader.role)}</Badge>
                <span className="text-xs font-normal text-muted-foreground">{leader.departmentCode ?? "All departments"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {leader.jobs.length ? (
                <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium"><BriefcaseBusiness className="h-4 w-4" />Direct manager jobs</div>
                  <JobRows jobs={leader.jobs} />
                </div>
              ) : null}
              {supervisors.length ? supervisors.map((supervisor) => (
                <SupervisorNode
                  key={supervisor.id}
                  person={supervisor}
                  staff={(childrenOf.get(supervisor.id) ?? []).filter((person) => person.role === "STAFF")}
                />
              )) : <p className="text-sm text-muted-foreground">No supervisors currently mapped to this leader.</p>}
            </CardContent>
          </Card>
        );
      })}

      {orphanSupervisors.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Supervisors without a visible manager/admin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {orphanSupervisors.map((supervisor) => (
              <SupervisorNode
                key={supervisor.id}
                person={supervisor}
                staff={(childrenOf.get(supervisor.id) ?? []).filter((person) => person.role === "STAFF")}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
