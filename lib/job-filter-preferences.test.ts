import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDefaultJobFilters,
  hasExplicitAllJobsFilters,
  parseDefaultJobFilters,
} from "@/lib/job-filter-preferences";

test("sorting alone does not suppress per-user default filters", () => {
  assert.equal(hasExplicitAllJobsFilters(new URLSearchParams("sortBy=client&sortDir=desc")), false);
});

test("an actual job filter suppresses automatic defaults", () => {
  assert.equal(hasExplicitAllJobsFilters(new URLSearchParams("department=VAT&sortBy=client")), true);
});

test("saved department and state defaults are applied to navigation params", () => {
  const defaults = parseDefaultJobFilters({
    departments: ["AFS", "BK", "SOFTWARE_BK"],
    stateFilters: ["state_3", "state_4", "state_5", "state_6", "state_7"],
  });
  assert.ok(defaults);

  const params = new URLSearchParams("sortBy=jobNo");
  applyDefaultJobFilters(params, defaults);

  assert.deepEqual(params.getAll("department"), ["AFS", "BK", "SOFTWARE_BK"]);
  assert.deepEqual(params.getAll("stateFilter"), ["state_3", "state_4", "state_5", "state_6", "state_7"]);
  assert.equal(params.get("sortBy"), "jobNo");
});
