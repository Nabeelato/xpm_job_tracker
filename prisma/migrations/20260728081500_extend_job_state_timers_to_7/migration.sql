ALTER TABLE "job_state_time_records"
DROP CONSTRAINT "job_state_time_records_state_number_check";

ALTER TABLE "job_state_time_records"
ADD CONSTRAINT "job_state_time_records_state_number_check"
CHECK ("state_number" BETWEEN 1 AND 7);

-- Reconstruct historical visits to state 7 from the same import change log
-- used by the original state 1-6 timer migration.
WITH numeric_state_events AS (
    SELECT
        "job_id",
        "new_value"::INTEGER AS "state_number",
        "changed_at" AS "entered_at",
        LEAD("changed_at") OVER (
            PARTITION BY "job_id"
            ORDER BY "changed_at", "id"
        ) AS "next_state_at"
    FROM "job_change_logs"
    WHERE "field_name" = 'job_state_number'
      AND "new_value" ~ '^[0-9]{1,2}$'
),
state_seven_events AS (
    SELECT
        event."job_id",
        event."state_number",
        event."entered_at",
        CASE
            WHEN event."next_state_at" IS NOT NULL THEN event."next_state_at"
            WHEN job."job_state_number" = 7 THEN NULL
            ELSE GREATEST(event."entered_at", COALESCE(job."state_entered_at", job."updated_at"))
        END AS "exited_at"
    FROM numeric_state_events AS event
    JOIN "jobs" AS job ON job."id" = event."job_id"
    WHERE event."state_number" = 7
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
    'state-time-' || md5("job_id" || "entered_at"::TEXT || "state_number"::TEXT),
    "job_id",
    "state_number",
    "entered_at",
    "exited_at",
    "entered_at"
FROM state_seven_events
ON CONFLICT ("id") DO NOTHING;

-- Ensure every job currently in state 7 has an active visit, including jobs
-- that predate change logging.
INSERT INTO "job_state_time_records" (
    "id",
    "job_id",
    "state_number",
    "entered_at",
    "created_at"
)
SELECT
    'state-time-current-' || md5(job."id"),
    job."id",
    7,
    COALESCE(job."state_entered_at", job."updated_at"),
    COALESCE(job."state_entered_at", job."updated_at")
FROM "jobs" AS job
WHERE job."job_state_number" = 7
  AND NOT EXISTS (
      SELECT 1
      FROM "job_state_time_records" AS record
      WHERE record."job_id" = job."id"
        AND record."exited_at" IS NULL
  );
