import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignUserToRole,
  canManageJobAssignmentRole,
  type AssignmentPermissionUser,
} from "./assignment-permissions";

const admin: AssignmentPermissionUser = { id: "admin", role: "ADMIN", departmentId: "vat" };
const manager: AssignmentPermissionUser = { id: "manager", role: "MANAGER", departmentId: "vat" };
const otherManager: AssignmentPermissionUser = { id: "manager-2", role: "MANAGER", departmentId: "vat" };
const supervisor: AssignmentPermissionUser = { id: "supervisor", role: "SUPERVISOR", departmentId: "vat" };
const otherSupervisor: AssignmentPermissionUser = { id: "supervisor-2", role: "SUPERVISOR", departmentId: "vat" };
const staff: AssignmentPermissionUser = {
  id: "staff",
  role: "STAFF",
  departmentId: "vat",
  supervisorId: supervisor.id,
};

test("admins can assign users only to their native job role", () => {
  assert.equal(canAssignUserToRole(admin, otherManager, "SUPERVISOR"), false);
  assert.equal(canAssignUserToRole(admin, otherSupervisor, "STAFF"), false);
  assert.equal(canAssignUserToRole(admin, otherSupervisor, "SUPERVISOR"), true);
  assert.equal(canAssignUserToRole(admin, staff, "STAFF"), true);
  assert.equal(canAssignUserToRole(admin, staff, "SUPERVISOR"), false);
});

test("managers remain department-scoped and cannot fill supervisor or staff roles", () => {
  assert.equal(canAssignUserToRole(manager, manager, "SUPERVISOR"), false);
  assert.equal(canAssignUserToRole(manager, manager, "STAFF"), false);
  assert.equal(canAssignUserToRole(manager, otherManager, "STAFF"), false);
  assert.equal(canAssignUserToRole(manager, otherSupervisor, "SUPERVISOR"), true);
  assert.equal(
    canAssignUserToRole(manager, { ...otherSupervisor, departmentId: "afs" }, "SUPERVISOR"),
    false,
  );
});

test("supervisors can assign only their direct staff on supervised jobs", () => {
  const activeAssignments = [{ userId: supervisor.id, assignmentRole: "SUPERVISOR" as const }];
  assert.equal(canManageJobAssignmentRole({
    actor: supervisor,
    assignee: supervisor,
    assignmentRole: "STAFF",
    activeAssignments,
    operation: "ASSIGN",
  }), false);
  assert.equal(canManageJobAssignmentRole({
    actor: supervisor,
    assignee: staff,
    assignmentRole: "STAFF",
    activeAssignments,
    operation: "ASSIGN",
  }), true);
  assert.equal(canManageJobAssignmentRole({
    actor: supervisor,
    assignee: otherSupervisor,
    assignmentRole: "STAFF",
    activeAssignments,
    operation: "ASSIGN",
  }), false);
});

test("managers must own the job and can assign relevant staff only", () => {
  assert.equal(canManageJobAssignmentRole({
    actor: manager,
    assignee: staff,
    assignmentRole: "STAFF",
    activeAssignments: [],
    operation: "ASSIGN",
  }), false);
  assert.equal(canManageJobAssignmentRole({
    actor: manager,
    assignee: staff,
    assignmentRole: "STAFF",
    activeAssignments: [{ userId: manager.id, assignmentRole: "MANAGER" }],
    operation: "ASSIGN",
  }), false);
  assert.equal(canManageJobAssignmentRole({
    actor: manager,
    assignee: staff,
    assignmentRole: "STAFF",
    activeAssignments: [
      { userId: manager.id, assignmentRole: "MANAGER" },
      { userId: supervisor.id, assignmentRole: "SUPERVISOR" },
    ],
    operation: "ASSIGN",
  }), true);
});
