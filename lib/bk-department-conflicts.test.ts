import assert from "node:assert/strict";
import test from "node:test";
import { bkDepartmentConflictReasons, type BkDepartmentConflictJob } from "./bk-department-conflicts";

function job(departmentCode: string, sourcePartnerName: string | null = null): BkDepartmentConflictJob {
  return { finalDepartment: { code: departmentCode }, sourcePartnerName };
}

test("flags a client whose active jobs are split between BK and Software BK", () => {
  assert.deepEqual(
    bkDepartmentConflictReasons([job("BK"), job("SOFTWARE_BK")]),
    ["mixed_departments"],
  );
});

test("flags a client whose active jobs contain both Taaha and Irfan source partners", () => {
  assert.deepEqual(
    bkDepartmentConflictReasons([
      job("BK", "Taaha Imran"),
      job("BK", "Irfan Tanwir"),
    ]),
    ["mixed_source_partners"],
  );
});

test("does not flag a single-department client with only one source partner", () => {
  assert.deepEqual(bkDepartmentConflictReasons([job("BK", "Taaha Sheikh")]), []);
});
