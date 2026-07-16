CREATE TABLE "job_state_time_records" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "state_number" INTEGER NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "exited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_state_time_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_state_time_records_state_number_check" CHECK ("state_number" BETWEEN 1 AND 6),
    CONSTRAINT "job_state_time_records_interval_check" CHECK ("exited_at" IS NULL OR "exited_at" >= "entered_at")
);

-- Reconstruct every recorded visit to states 1-6. The next numeric state
-- transition closes the previous visit, including transitions to state 7+.
WITH numeric_state_events AS (
    SELECT
        "id" AS "event_id",
        "job_id",
        "new_value"::INTEGER AS "state_number",
        "changed_at" AS "entered_at",
        LEAD("changed_at") OVER (
            PARTITION BY "job_id"
            ORDER BY "changed_at", "id"
        ) AS "exited_at"
    FROM "job_change_logs"
    WHERE "field_name" = 'job_state_number'
      AND "new_value" ~ '^[0-9]{1,2}$'
)
INSERT INTO "job_state_time_records" (
    "id",
    "job_id",
    "state_number",
    "entered_at",
    "exited_at",
    "created_at"
)
SELECT
    'state-time-' || "event_id",
    "job_id",
    "state_number",
    "entered_at",
    "exited_at",
    "entered_at"
FROM numeric_state_events
WHERE "state_number" BETWEEN 1 AND 6;

-- Close any reconstructed open visit that disagrees with the job's current
-- state. This covers older data where a transition was not change-logged.
UPDATE "job_state_time_records" AS record
SET "exited_at" = GREATEST(record."entered_at", COALESCE(job."state_entered_at", job."updated_at"))
FROM "jobs" AS job
WHERE record."job_id" = job."id"
  AND record."exited_at" IS NULL
  AND (
      job."job_state_number" IS NULL
      OR job."job_state_number" NOT BETWEEN 1 AND 6
      OR job."job_state_number" <> record."state_number"
  );

-- Ensure every job currently in a timed state has an active visit, even when
-- it predates change logging.
INSERT INTO "job_state_time_records" (
    "id",
    "job_id",
    "state_number",
    "entered_at",
    "created_at"
)
SELECT
    'state-current-' || MD5(job."id" || COALESCE(job."state_entered_at", job."updated_at")::TEXT),
    job."id",
    job."job_state_number",
    COALESCE(job."state_entered_at", job."updated_at"),
    COALESCE(job."state_entered_at", job."updated_at")
FROM "jobs" AS job
WHERE job."job_state_number" BETWEEN 1 AND 6
  AND NOT EXISTS (
      SELECT 1
      FROM "job_state_time_records" AS record
      WHERE record."job_id" = job."id"
        AND record."exited_at" IS NULL
  );

CREATE INDEX "job_state_time_records_job_id_state_number_idx"
ON "job_state_time_records"("job_id", "state_number");

CREATE INDEX "job_state_time_records_job_id_exited_at_idx"
ON "job_state_time_records"("job_id", "exited_at");

CREATE UNIQUE INDEX "job_state_time_records_one_active_per_job_idx"
ON "job_state_time_records"("job_id")
WHERE "exited_at" IS NULL;

ALTER TABLE "job_state_time_records"
ADD CONSTRAINT "job_state_time_records_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- These belonged to the superseded state-3-to-state-11 lifecycle timer.
ALTER TABLE "jobs"
DROP COLUMN "job_started_at",
DROP COLUMN "job_completed_at";
