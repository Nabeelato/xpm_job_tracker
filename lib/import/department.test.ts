import assert from "node:assert/strict";
import test from "node:test";
import {
  detectClientCategoryFromPartner,
  detectDepartmentFromManager,
  detectImportDepartment,
  hasAfsJobTitle,
} from "./department";

test("AFS requires Maaz Imran and a YE/PE marker in the job title", () => {
  assert.equal(detectDepartmentFromManager("Maaz Imran", "YE/PE December 2026"), "AFS");
  assert.equal(detectDepartmentFromManager("Maaz Imran", "PE / YE December 2026"), "AFS");
  assert.equal(detectDepartmentFromManager("Maaz Imran", "Monthly bookkeeping"), null);
  assert.equal(detectDepartmentFromManager("Maaz Ahmed", "YE/PE December 2026"), null);
  assert.equal(hasAfsJobTitle("Annual accounts"), false);
});

test("manager-led import department rules match the configured people", () => {
  assert.equal(detectImportDepartment("Taaha Imran", "Any job"), "BK");
  assert.equal(detectImportDepartment("Taaha Sheikh", "Any job"), "BK");
  assert.equal(detectImportDepartment("Irfan Tanwir", "Any job"), "SOFTWARE_BK");
  assert.equal(detectImportDepartment("Irfan Tanvir", "Any job"), "SOFTWARE_BK");
  assert.equal(detectImportDepartment("Faizan Ali", "Any job"), "VAT");
});

test("unknown managers remain unclassified even when the title contains a department keyword", () => {
  assert.equal(detectImportDepartment("Another Manager", "VAT Return"), "UNCLASSIFIED");
  assert.equal(detectImportDepartment(null, "Bookkeeping"), "UNCLASSIFIED");
});

test("client category is detected from source partner, not source manager", () => {
  assert.equal(detectClientCategoryFromPartner("Irfan Tanwir"), "SOFTWARE");
  assert.equal(detectClientCategoryFromPartner("Irfan Tanvir"), "SOFTWARE");
  assert.equal(detectClientCategoryFromPartner("Taaha Imran"), "MANUAL");
  assert.equal(detectClientCategoryFromPartner("Taaha Sheikh"), "MANUAL");
  assert.equal(detectClientCategoryFromPartner("Faizan Ali"), null);
});
