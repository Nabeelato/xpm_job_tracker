import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AssignmentRole, type Prisma, type UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWorkflowJobState, workflowStateWhere } from "@/lib/job-state";

export type AppSessionUser = {
  id: string;
  role: UserRole;
  departmentId?: string | null;
  departmentCode?: string | null;
  supervisorId?: string | null;
  name?: string | null;
  email?: string | null;
};

export const getCurrentUser = cache(async (): Promise<AppSessionUser | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      supervisorId: true,
      active: true,
      department: { select: { code: true } },
    },
  });

  if (!user?.active) return null;

  return {
    id: user.id,
    role: user.role,
    departmentId: user.departmentId,
    departmentCode: user.department?.code ?? null,
    supervisorId: user.supervisorId,
    name: user.name,
    email: user.email,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export function canUpload(role: UserRole) {
  return role === "ADMIN";
}

export function canManageUsers(role: UserRole) {
  return role === "ADMIN";
}

export function canAssignJobs(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canArchiveJobs(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function assignmentRoleForUser(role: UserRole): AssignmentRole {
  if (role === "STAFF") return AssignmentRole.STAFF;
  if (role === "SUPERVISOR") return AssignmentRole.SUPERVISOR;
  return AssignmentRole.MANAGER;
}

export function availableJobsWhere(user: AppSessionUser): Prisma.JobWhereInput {
  const rules: Prisma.JobWhereInput[] = [
    workflowStateWhere(),
    { archived: false },
    {
      OR: [
        { finalDepartment: { code: { not: "SOFTWARE_BK" } } },
        { assignments: { none: { active: true, assignmentRole: AssignmentRole.SUPERVISOR } } },
      ],
    },
  ];

  if (user.role === "ADMIN") return { AND: rules };

  rules.push({
    assignments: {
      none: { active: true, assignmentRole: assignmentRoleForUser(user.role) },
    },
  });

  if (user.departmentCode !== "QC") {
    if (!user.departmentId) return { id: "__no_department__" };
    rules.push({ finalDepartmentId: user.departmentId });
  }

  if (user.role === "STAFF") {
    if (!user.supervisorId) return { id: "__no_supervisor__" };
    rules.push({
      assignments: {
        some: {
          active: true,
          assignmentRole: AssignmentRole.SUPERVISOR,
          userId: user.supervisorId,
        },
      },
    });
  }

  return { AND: rules };
}

export function visibleJobsWhere(user: AppSessionUser): Prisma.JobWhereInput {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return {};
  if (user.role === "MANAGER") {
    return user.departmentId ? { finalDepartmentId: user.departmentId } : { id: "__no_department__" };
  }
  return {
    OR: [
      { assignments: { some: { userId: user.id, active: true } } },
      availableJobsWhere(user),
    ],
  };
}

export function canWriteDiary(user: AppSessionUser) {
  return user.role === "ADMIN" || user.role === "MANAGER" || user.departmentCode === "QC";
}

type InteractiveJob = {
  assignments: Array<{ userId: string; assignmentRole: AssignmentRole }>;
  finalDepartmentId?: string;
  jobStateNumber?: number | null;
  xpmState?: string | null;
  archived?: boolean;
};

export function canInteractWithJob(user: AppSessionUser, job: InteractiveJob) {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return true;
  if (job.assignments.some((assignment) => assignment.userId === user.id)) return true;
  const departmentMatches = Boolean(user.departmentId) && job.finalDepartmentId === user.departmentId;
  if (user.role === "MANAGER" && departmentMatches) return true;
  const softwareSupervisorAssigned = user.departmentCode === "SOFTWARE_BK" && job.assignments.some(
    (assignment) => assignment.assignmentRole === AssignmentRole.SUPERVISOR,
  );
  const staffSupervisorAssigned = user.role !== "STAFF" || Boolean(
    user.supervisorId && job.assignments.some(
      (assignment) => assignment.assignmentRole === AssignmentRole.SUPERVISOR && assignment.userId === user.supervisorId,
    ),
  );
  return Boolean(
    departmentMatches && !softwareSupervisorAssigned && staffSupervisorAssigned &&
    !job.archived && isWorkflowJobState(job.jobStateNumber, job.xpmState) &&
    !job.assignments.some((assignment) => assignment.assignmentRole === assignmentRoleForUser(user.role))
  );
}

export function assertCanViewJob(user: AppSessionUser, job: InteractiveJob) {
  if (canInteractWithJob(user, job)) return true;
  redirect("/jobs/my");
}
