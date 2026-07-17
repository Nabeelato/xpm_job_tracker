import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AssignmentRole, type Prisma, type UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { workflowStateWhere } from "@/lib/job-state";

export type AppSessionUser = {
  id: string;
  role: UserRole;
  departmentId?: string | null;
  departmentCode?: string | null;
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
  if (user.role === "ADMIN") {
    return {
      ...workflowStateWhere(),
      archived: false,
    };
  }
  return {
    ...workflowStateWhere(),
    archived: false,
    assignments: {
      none: { active: true, assignmentRole: assignmentRoleForUser(user.role) },
    },
  };
}

export function visibleJobsWhere(user: AppSessionUser): Prisma.JobWhereInput {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return {};
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
  archived?: boolean;
};

export function canInteractWithJob(user: AppSessionUser, job: InteractiveJob) {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return true;
  if (job.assignments.some((assignment) => assignment.userId === user.id)) return true;
  return Boolean(
    !job.archived && job.jobStateNumber && [3, 4, 5, 6].includes(job.jobStateNumber) &&
    !job.assignments.some((assignment) => assignment.assignmentRole === assignmentRoleForUser(user.role))
  );
}

export function assertCanViewJob(user: AppSessionUser, job: InteractiveJob) {
  if (canInteractWithJob(user, job)) return true;
  redirect("/jobs/my");
}
