import assert from "node:assert/strict";
import test from "node:test";
import type { AppSessionUser } from "@/lib/rbac";
import {
  availableJobsWhere,
  canInteractWithJob,
  visibleAvailableQueueJobsWhere,
  visibleJobsWhere,
} from "@/lib/rbac";

function user(overrides: Partial<AppSessionUser>): AppSessionUser {
  return {
    id: "user-1",
    role: "STAFF",
    departmentId: "department-1",
    departmentCode: "VAT",
    supervisorId: "supervisor-1",
    ...overrides,
  };
}

test("every QC role has unrestricted all-jobs visibility", () => {
  for (const role of ["MANAGER", "SUPERVISOR", "STAFF"] as const) {
    assert.deepEqual(visibleJobsWhere(user({ role, departmentCode: "QC" })), {});
  }
});

test("every role sees the same global workflow queue as an admin", () => {
  const adminQueue = visibleAvailableQueueJobsWhere(user({ role: "ADMIN", departmentCode: "AFS" }));

  for (const role of ["MANAGER", "SUPERVISOR", "STAFF"] as const) {
    for (const departmentCode of ["QC", "VAT", "BK"] as const) {
      const queue = visibleAvailableQueueJobsWhere(user({ role, departmentCode }));
      assert.deepEqual(queue, adminQueue);
    }
  }

  assert.doesNotMatch(JSON.stringify(adminQueue), /finalDepartment|SOFTWARE_BK/);
});

test("staff, supervisors, and managers can claim available roles across departments", () => {
  for (const role of ["MANAGER", "SUPERVISOR", "STAFF"] as const) {
    const claimWhere = availableJobsWhere(user({
      role,
      departmentCode: "VAT",
      departmentId: "vat-department",
    }));
    const serialized = JSON.stringify(claimWhere);

    assert.match(serialized, new RegExp(role));
    assert.doesNotMatch(serialized, /vat-department|finalDepartment/);
  }
});

test("staff queue and interaction do not require a configured supervisor", () => {
  const staff = user({ role: "STAFF", supervisorId: null });
  const serialized = JSON.stringify(availableJobsWhere(staff));

  assert.doesNotMatch(serialized, /__no_supervisor__|supervisor-1/);
  assert.equal(canInteractWithJob(staff, {
    assignments: [],
    finalDepartmentId: staff.departmentId ?? undefined,
    jobStateNumber: 4,
    archived: false,
  }), true);
});

test("managers retain access to jobs they claim outside their department", () => {
  const manager = user({
    id: "manager-1",
    role: "MANAGER",
    departmentId: "vat-department",
    departmentCode: "VAT",
  });
  const serialized = JSON.stringify(visibleJobsWhere(manager));

  assert.match(serialized, /manager-1/);
  assert.match(serialized, /vat-department/);
  assert.equal(canInteractWithJob(manager, {
    assignments: [{ userId: manager.id, assignmentRole: "MANAGER" }],
    finalDepartmentId: "bk-department",
    jobStateNumber: 4,
    archived: false,
  }), true);
});

test("Faizan sees only jobs attributed to him by XPM", () => {
  const faizan = user({
    id: "faizan-id",
    username: "faizan.ali",
    name: "Faizan Ali",
    role: "MANAGER",
    departmentCode: "VAT",
    departmentId: "vat-department",
  });

  assert.deepEqual(visibleJobsWhere(faizan), {
    sourceManagerName: { equals: "Faizan Ali", mode: "insensitive" },
  });
  assert.match(JSON.stringify(availableJobsWhere(faizan)), /Faizan Ali/);
  assert.doesNotMatch(JSON.stringify(availableJobsWhere(faizan)), /vat-department/);
});

test("Faizan cannot bypass XPM visibility with a direct job URL", () => {
  const faizan = user({ username: "faizan.ali", name: "Faizan Ali", role: "MANAGER" });
  const baseJob = {
    assignments: [{ userId: faizan.id, assignmentRole: "MANAGER" as const }],
    finalDepartmentId: faizan.departmentId ?? undefined,
    jobStateNumber: 4,
    archived: false,
  };

  assert.equal(canInteractWithJob(faizan, { ...baseJob, sourceManagerName: "Faizan Ali" }), true);
  assert.equal(canInteractWithJob(faizan, { ...baseJob, sourceManagerName: "Maaz Imran" }), false);
});
