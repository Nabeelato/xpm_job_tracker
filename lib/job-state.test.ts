import assert from "node:assert/strict";
import test from "node:test";
import { nextJobLifecycleTimestamps, nextStateEnteredAt, parseJobStateNumber } from "./job-state";
import { formatElapsedTime } from "./utils";

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

test("job lifecycle starts once at state 3 and continues through intermediate states", () => {
  const started = nextJobLifecycleTimestamps({
    nextStateNumber: 3,
    jobStartedAt: null,
    jobCompletedAt: null,
    observedAt,
  });
  assert.equal(started.jobStartedAt, observedAt);
  assert.equal(started.jobCompletedAt, null);

  const laterObservation = new Date("2026-07-15T09:00:00.000Z");
  const progressed = nextJobLifecycleTimestamps({
    nextStateNumber: 6,
    jobStartedAt: started.jobStartedAt,
    jobCompletedAt: started.jobCompletedAt,
    observedAt: laterObservation,
  });
  assert.equal(progressed.jobStartedAt, observedAt);
  assert.equal(progressed.jobCompletedAt, null);
});

test("job lifecycle freezes on the first observation of state 11", () => {
  const completedAt = new Date("2026-07-16T09:00:00.000Z");
  const completed = nextJobLifecycleTimestamps({
    nextStateNumber: 11,
    jobStartedAt: previousEnteredAt,
    jobCompletedAt: null,
    observedAt: completedAt,
  });
  assert.equal(completed.jobStartedAt, previousEnteredAt);
  assert.equal(completed.jobCompletedAt, completedAt);

  const laterImport = new Date("2026-07-17T09:00:00.000Z");
  const preserved = nextJobLifecycleTimestamps({
    nextStateNumber: 11,
    jobStartedAt: completed.jobStartedAt,
    jobCompletedAt: completed.jobCompletedAt,
    observedAt: laterImport,
  });
  assert.equal(preserved.jobCompletedAt, completedAt);
});

test("idle time reports the elapsed state-3 to state-11 duration", () => {
  assert.equal(
    formatElapsedTime(
      new Date("2026-07-13T09:00:00.000Z"),
      new Date("2026-07-15T12:27:00.000Z"),
    ),
    "2d 3h",
  );
  assert.equal(formatElapsedTime(null, observedAt), "-");
});
