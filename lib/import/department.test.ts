import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDepartmentFromManager,
  detectImportDepartment,
  hasAfsJobTitle,
  isIrfanSourcePerson,
  isTaahaSourcePerson,
} from "./department";

test("all Maaz Imran jobs are assigned to AFS", () => {
  assert.equal(detectDepartmentFromManager("Maaz Imran", "YE/PE December 2026"), "AFS");
  assert.equal(detectDepartmentFromManager("Maaz Imran", "PE / YE December 2026"), "AFS");
  assert.equal(detectDepartmentFromManager("Maaz Imran", "Cessation of Account"), "AFS");
  assert.equal(detectDepartmentFromManager("Maaz Imran", "Management Account"), "AFS");
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

test("unknown managers use title rules and otherwise fall back to AFS", () => {
  assert.equal(detectImportDepartment("Another Manager", "VAT Return"), "VAT");
  assert.equal(detectImportDepartment(null, "Bookkeeping"), "BK");
  assert.equal(detectImportDepartment(null, "Software implementation"), "SOFTWARE_BK");
  assert.equal(detectImportDepartment(null, "Cessation of Account"), "AFS");
  assert.equal(detectImportDepartment(null, "Unmatched advisory work"), "AFS");
});

test("source partner aliases are recognized for BK department conflict alarms", () => {
  assert.equal(isIrfanSourcePerson("Irfan Tanwir"), true);
  assert.equal(isIrfanSourcePerson("Irfan Tanvir"), true);
  assert.equal(isTaahaSourcePerson("Taaha Imran"), true);
  assert.equal(isTaahaSourcePerson("Taaha Sheikh"), true);
  assert.equal(isTaahaSourcePerson("Faizan Ali"), false);
});
