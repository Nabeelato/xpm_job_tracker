import assert from "node:assert/strict";
import test from "node:test";
import { nextStateEnteredAt, parseJobStateNumber } from "./job-state";

const previousEnteredAt = new Date("2026-07-13T09:00:00.000Z");
const observedAt = new Date("2026-07-14T09:00:00.000Z");

test("state entry time starts when a job is first observed in state 3", () => {
  assert.equal(nextStateEnteredAt({
    previousStateNumber: null,
    nextStateNumber: 3,
    previousStateEnteredAt: null,
    observedAt,
  }), observedAt);
});

test("numeric state changes reset state entry time", () => {
  for (const [previousStateNumber, nextStateNumber] of [[2, 3], [3, 4]] as const) {
    assert.equal(nextStateEnteredAt({
      previousStateNumber,
      nextStateNumber,
      previousStateEnteredAt: previousEnteredAt,
      observedAt,
    }), observedAt);
  }
});

test("unchanged numeric states preserve state entry time", () => {
  assert.equal(parseJobStateNumber("3.1 Job on hold"), 3);
  assert.equal(parseJobStateNumber("3.2 IFZA check"), 3);
  assert.equal(nextStateEnteredAt({
    previousStateNumber: 3,
    nextStateNumber: 3,
    previousStateEnteredAt: previousEnteredAt,
    observedAt,
  }), previousEnteredAt);
});

test("clearing the numeric state clears state entry time", () => {
  assert.equal(nextStateEnteredAt({
    previousStateNumber: 3,
    nextStateNumber: null,
    previousStateEnteredAt: previousEnteredAt,
    observedAt,
  }), null);
});
