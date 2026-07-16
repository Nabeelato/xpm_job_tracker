import assert from "node:assert/strict";
import test from "node:test";
import {
  jobStateTimerTransition,
  nextStateEnteredAt,
  parseJobStateNumber,
  summarizeJobStateTime,
} from "./job-state";
import { formatElapsedMilliseconds } from "./utils";

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

test("state timer closes and restarts on each numeric state change", () => {
  assert.deepEqual(jobStateTimerTransition(3, 4), {
    closeActiveRecord: true,
    startStateNumber: 4,
  });
  assert.deepEqual(jobStateTimerTransition(4, 7), {
    closeActiveRecord: true,
    startStateNumber: null,
  });
  assert.deepEqual(jobStateTimerTransition(3, 3), {
    closeActiveRecord: false,
    startStateNumber: null,
  });
});

test("returning to a previous state resumes its accumulated timer", () => {
  const firstVisitStarted = new Date("2026-07-13T09:00:00.000Z");
  const firstVisitEnded = new Date("2026-07-13T11:30:00.000Z");
  const resumedAt = new Date("2026-07-14T09:00:00.000Z");
  const summary = summarizeJobStateTime([
    { stateNumber: 3, enteredAt: firstVisitStarted, exitedAt: firstVisitEnded },
    { stateNumber: 5, enteredAt: firstVisitEnded, exitedAt: resumedAt },
    { stateNumber: 3, enteredAt: resumedAt, exitedAt: null },
  ], 3);

  assert.equal(summary.accumulatedMs, 2.5 * 60 * 60 * 1_000);
  assert.equal(summary.activeEnteredAt, resumedAt);
  assert.equal(
    formatElapsedMilliseconds(
      summary.accumulatedMs + new Date("2026-07-14T10:15:00.000Z").getTime() - resumedAt.getTime(),
    ),
    "3h 45m",
  );
});

test("states 7 and above do not start timers", () => {
  for (const state of [7, 8, 11, 12]) {
    assert.equal(jobStateTimerTransition(6, state).startStateNumber, null);
  }
});
