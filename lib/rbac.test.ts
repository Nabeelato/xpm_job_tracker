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

test("every QC role sees the same global available queue as an admin", () => {
  const adminQueue = visibleAvailableQueueJobsWhere(user({ role: "ADMIN", departmentCode: "AFS" }));

  for (const role of ["MANAGER", "SUPERVISOR", "STAFF"] as const) {
    const qcQueue = visibleAvailableQueueJobsWhere(user({ role, departmentCode: "QC" }));
    assert.deepEqual(qcQueue, adminQueue);
  }
});

test("QC global queue visibility does not broaden self-claim eligibility", () => {
  const qcManager = user({ role: "MANAGER", departmentCode: "QC", departmentId: "qc-department" });
  const claimWhere = availableJobsWhere(qcManager);

  assert.notDeepEqual(claimWhere, visibleAvailableQueueJobsWhere(qcManager));
  assert.match(JSON.stringify(claimWhere), /MANAGER/);
});

test("non-QC available queues remain department and role scoped", () => {
  const vatSupervisor = user({ role: "SUPERVISOR", departmentCode: "VAT", departmentId: "vat-department" });
  const where = visibleAvailableQueueJobsWhere(vatSupervisor);
  const serialized = JSON.stringify(where);

  assert.match(serialized, /vat-department/);
  assert.match(serialized, /SUPERVISOR/);
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
