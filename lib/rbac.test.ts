import assert from "node:assert/strict";
import test from "node:test";
import type { AppSessionUser } from "@/lib/rbac";
import {
  availableJobsWhere,
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
