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

export function isElevatedRole(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";
}

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
    if (assignmentRole === "MANAGER") return isNativeRoleMatch(assignee, assignmentRole);
    if (assignmentRole === "SUPERVISOR") return isElevatedRole(assignee.role);
    return true;
  }

  if (actor.role === "MANAGER") {
    if (!actor.departmentId || assignee.departmentId !== actor.departmentId) return false;
    if (actor.id === assignee.id && (assignmentRole === "SUPERVISOR" || assignmentRole === "STAFF")) {
      return true;
    }
    return isNativeRoleMatch(assignee, assignmentRole);
  }

  if (actor.role === "SUPERVISOR") {
    if (actor.id === assignee.id && (assignmentRole === "SUPERVISOR" || assignmentRole === "STAFF")) {
      return true;
    }
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
  if (actor.role === "ADMIN") {
    return operation === "REMOVE" || canAssignUserToRole(actor, assignee, assignmentRole);
  }

  if (actor.role === "MANAGER") {
    const ownsJob = activeAssignments.some((assignment) => assignment.userId === actor.id);
    return ownsJob && canAssignUserToRole(actor, assignee, assignmentRole);
  }

  if (actor.role === "SUPERVISOR") {
    if (actor.id === assignee.id && assignmentRole === "SUPERVISOR") return true;

    const supervisesJob = activeAssignments.some(
      (assignment) => assignment.userId === actor.id && assignment.assignmentRole === "SUPERVISOR",
    );
    if (!supervisesJob || assignmentRole !== "STAFF") return false;
    return canAssignUserToRole(actor, assignee, assignmentRole);
  }

  return false;
}
