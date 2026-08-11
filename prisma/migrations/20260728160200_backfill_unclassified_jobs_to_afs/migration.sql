WITH target_departments AS (
  SELECT
    MAX("id") FILTER (WHERE "code" = 'AFS') AS "afs_id",
    MAX("id") FILTER (WHERE "code" = 'UNCLASSIFIED') AS "unclassified_id"
  FROM "departments"
),
moved_jobs AS (
  UPDATE "jobs" AS job
  SET
    "auto_detected_department_id" = target."afs_id",
    "final_department_id" = target."afs_id",
    "updated_at" = CURRENT_TIMESTAMP
  FROM target_departments AS target
  WHERE job."final_department_id" = target."unclassified_id"
    AND job."department_manually_overridden" = FALSE
    AND target."afs_id" IS NOT NULL
    AND target."unclassified_id" IS NOT NULL
  RETURNING job."id", target."unclassified_id", target."afs_id"
)
INSERT INTO "job_change_logs" (
  "id",
  "job_id",
  "change_source",
  "field_name",
  "old_value",
  "new_value",
  "changed_at"
)
SELECT
  'afs-fallback-' || MD5(moved."id"),
  moved."id",
  'SYSTEM'::"ChangeSource",
  'final_department_id',
  moved."unclassified_id",
  moved."afs_id",
  CURRENT_TIMESTAMP
FROM moved_jobs AS moved
ON CONFLICT ("id") DO NOTHING;

UPDATE "notifications" AS notification
SET "read_at" = CURRENT_TIMESTAMP
WHERE notification."type" = 'UNCLASSIFIED_JOB'::"NotificationType"
  AND notification."read_at" IS NULL
  AND notification."job_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "jobs" AS job
    JOIN "departments" AS department ON department."id" = job."final_department_id"
    WHERE job."id" = notification."job_id"
      AND department."code" = 'UNCLASSIFIED'
  );
