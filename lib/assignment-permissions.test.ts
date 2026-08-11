import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignUserToRole,
  canManageJobAssignmentRole,
  type AssignmentPermissionUser,
} from "./assignment-permissions";

const admin: AssignmentPermissionUser = { id: "admin", role: "ADMIN", departmentId: "vat" };
const manager: AssignmentPermissionUser = { id: "manager", role: "MANAGER", departmentId: "vat" };
const qcManager: AssignmentPermissionUser = {
  id: "qc-manager",
  role: "MANAGER",
  departmentId: "qc",
  departmentCode: "QC",
};
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

test("managers must own the job but can assign staff before their supervisor is on it", () => {
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
  }), true);
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

test("QC managers can directly assign eligible staff on any visible job", () => {
  assert.equal(canManageJobAssignmentRole({
    actor: qcManager,
    assignee: staff,
    assignmentRole: "STAFF",
    activeAssignments: [],
    operation: "ASSIGN",
  }), true);
  assert.equal(canManageJobAssignmentRole({
    actor: qcManager,
    assignee: supervisor,
    assignmentRole: "SUPERVISOR",
    activeAssignments: [],
    operation: "ASSIGN",
  }), true);
});

test("staff without a configured supervisor can be assigned", () => {
  assert.equal(canManageJobAssignmentRole({
    actor: admin,
    assignee: { ...staff, supervisorId: null },
    assignmentRole: "STAFF",
    activeAssignments: [],
    operation: "ASSIGN",
  }), true);
});
