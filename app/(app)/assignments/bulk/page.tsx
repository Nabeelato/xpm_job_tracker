import { PageHeader } from "@/components/page-header";
import { BulkAssignClient } from "@/components/bulk-assign-client";
import { prisma } from "@/lib/db";
import { requireRole, visibleJobsWhere } from "@/lib/rbac";

export default async function BulkAssignmentsPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);

  const [jobs, users] = await Promise.all([
    prisma.job.findMany({
      where: { AND: [{ archived: false }, visibleJobsWhere(user)] },
      select: {
        id: true,
        jobIdFromExcel: true,
        jobName: true,
        internalStatus: true,
        client: { select: { displayName: true } },
        finalDepartment: { select: { code: true } },
        assignments: {
          where: { active: true },
          select: { user: { select: { name: true } } },
        },
      },
      orderBy: [{ internalStatus: "asc" }, { updatedAt: "desc" }],
      take: 1000,
    }),
    prisma.user.findMany({
      where:
        user.role === "MANAGER"
          ? { active: true, departmentId: user.departmentId ?? "__none__", role: { in: ["SUPERVISOR", "STAFF"] } }
          : { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const jobsForClient = jobs.map((job) => ({
    id: job.id,
    jobIdFromExcel: job.jobIdFromExcel,
    clientName: job.client.displayName,
    jobName: job.jobName,
    departmentCode: job.finalDepartment?.code ?? null,
    internalStatus: job.internalStatus,
    assigneeNames: job.assignments.map((a) => a.user.name).filter((n): n is string => Boolean(n)),
  }));

  const usersForClient = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));

  return (
    <>
      <PageHeader
        description="Tick checkboxes to select jobs, then choose a user and role to assign. Use the search box or paste Job IDs to filter quickly."
        title="Bulk Assign Jobs"
      />
      <BulkAssignClient jobs={jobsForClient} users={usersForClient} />
    </>
  );
}
