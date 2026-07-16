ALTER TABLE "jobs"
ADD COLUMN "job_started_at" TIMESTAMP(3),
ADD COLUMN "job_completed_at" TIMESTAMP(3);

-- Prefer recorded state-change history for existing jobs.
UPDATE "jobs" AS job
SET "job_started_at" = history."started_at"
FROM (
  SELECT "job_id", MIN("changed_at") AS "started_at"
  FROM "job_change_logs"
  WHERE "field_name" = 'job_state_number' AND "new_value" = '3'
  GROUP BY "job_id"
) AS history
WHERE job."id" = history."job_id";

-- Jobs currently observed in state 3 may predate state-change logging.
UPDATE "jobs"
SET "job_started_at" = "state_entered_at"
WHERE "job_started_at" IS NULL AND "job_state_number" = 3;

UPDATE "jobs" AS job
SET "job_completed_at" = history."completed_at"
FROM (
  SELECT "job_id", MIN("changed_at") AS "completed_at"
  FROM "job_change_logs"
  WHERE "field_name" = 'job_state_number' AND "new_value" = '11'
  GROUP BY "job_id"
) AS history
WHERE job."id" = history."job_id";

-- Jobs currently observed in state 11 may predate state-change logging.
UPDATE "jobs"
SET "job_completed_at" = "state_entered_at"
WHERE "job_completed_at" IS NULL AND "job_state_number" = 11;
