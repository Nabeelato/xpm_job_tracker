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

test("admins can cross-assign elevated users without promoting staff", () => {
  assert.equal(canAssignUserToRole(admin, otherManager, "SUPERVISOR"), true);
  assert.equal(canAssignUserToRole(admin, otherSupervisor, "STAFF"), true);
  assert.equal(canAssignUserToRole(admin, staff, "SUPERVISOR"), false);
});

test("managers can cross-assign only themselves and remain department-scoped", () => {
  assert.equal(canAssignUserToRole(manager, manager, "SUPERVISOR"), true);
  assert.equal(canAssignUserToRole(manager, manager, "STAFF"), true);
  assert.equal(canAssignUserToRole(manager, otherManager, "STAFF"), false);
  assert.equal(canAssignUserToRole(manager, otherSupervisor, "SUPERVISOR"), true);
  assert.equal(
    canAssignUserToRole(manager, { ...otherSupervisor, departmentId: "afs" }, "SUPERVISOR"),
    false,
  );
});

test("supervisors can manage themselves and their direct staff only on supervised jobs", () => {
  const activeAssignments = [{ userId: supervisor.id, assignmentRole: "SUPERVISOR" as const }];
  assert.equal(canManageJobAssignmentRole({
    actor: supervisor,
    assignee: supervisor,
    assignmentRole: "STAFF",
    activeAssignments,
    operation: "ASSIGN",
  }), true);
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

test("managers must already own a job before managing its assignments", () => {
  assert.equal(canManageJobAssignmentRole({
    actor: manager,
    assignee: manager,
    assignmentRole: "STAFF",
    activeAssignments: [],
    operation: "ASSIGN",
  }), false);
  assert.equal(canManageJobAssignmentRole({
    actor: manager,
    assignee: manager,
    assignmentRole: "STAFF",
    activeAssignments: [{ userId: manager.id, assignmentRole: "MANAGER" }],
    operation: "ASSIGN",
  }), true);
});
