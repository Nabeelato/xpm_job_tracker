import type { AssignmentRole, UserRole } from "@prisma/client";

export type AssignmentPermissionUser = {
  id: string;
  role: UserRole;
  departmentId?: string | null;
  supervisorId?: string | null;
};

export type ActiveAssignmentRef = {
  userId: string;
  assignmentRole: AssignmentRole;
};

function isNativeRoleMatch(assignee: AssignmentPermissionUser, assignmentRole: AssignmentRole) {
  if (assignmentRole === "MANAGER") {
    return assignee.role === "ADMIN" || assignee.role === "MANAGER";
  }
  if (assignmentRole === "SUPERVISOR") return assignee.role === "SUPERVISOR";
  return assignee.role === "STAFF";
}

export function canAssignUserToRole(
  actor: AssignmentPermissionUser,
  assignee: AssignmentPermissionUser,
  assignmentRole: AssignmentRole,
) {
  if (actor.role === "ADMIN") {
    return isNativeRoleMatch(assignee, assignmentRole);
  }

  if (actor.role === "MANAGER") {
    if (!actor.departmentId || assignee.departmentId !== actor.departmentId) return false;
    return isNativeRoleMatch(assignee, assignmentRole);
  }

  if (actor.role === "SUPERVISOR") {
    return assignmentRole === "STAFF" && assignee.role === "STAFF" && assignee.supervisorId === actor.id;
  }

  return false;
}

export function canManageJobAssignmentRole({
  actor,
  assignee,
  assignmentRole,
  activeAssignments,
  operation,
}: {
  actor: AssignmentPermissionUser;
  assignee: AssignmentPermissionUser;
  assignmentRole: AssignmentRole;
  activeAssignments: ActiveAssignmentRef[];
  operation: "ASSIGN" | "REMOVE";
}) {
  if (operation === "ASSIGN" && assignmentRole === "STAFF") {
    // Staff must have a configured supervisor so manager-level assignments can
    // add that supervisor to the job automatically.
    if (!assignee.supervisorId) return false;
  }

  if (actor.role === "ADMIN") {
    return operation === "REMOVE" || canAssignUserToRole(actor, assignee, assignmentRole);
  }

  if (actor.role === "MANAGER") {
    const ownsJob = activeAssignments.some((assignment) => assignment.userId === actor.id);
    return ownsJob && canAssignUserToRole(actor, assignee, assignmentRole);
  }

  if (actor.role === "SUPERVISOR") {
    const supervisesJob = activeAssignments.some(
      (assignment) => assignment.userId === actor.id && assignment.assignmentRole === "SUPERVISOR",
    );
    if (!supervisesJob || assignmentRole !== "STAFF") return false;
    return canAssignUserToRole(actor, assignee, assignmentRole);
  }

  return false;
}
