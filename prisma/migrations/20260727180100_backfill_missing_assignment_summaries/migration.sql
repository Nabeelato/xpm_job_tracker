INSERT INTO "notifications" ("id", "recipient_id", "type", "title", "body", "href")
SELECT
  gen_random_uuid()::text,
  admin_user."id",
  'MISSING_STAFF'::"NotificationType",
  'Missing staff assignments',
  exception_count."count" || ' active jobs do not have an active staff assignment. Review the exception report now.',
  '/reports/exceptions?type=missing_staff'
FROM "users" AS admin_user
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS "count"
  FROM "jobs" AS job
  WHERE job."archived" = false
    AND (job."job_state_number" IS NULL OR job."job_state_number" NOT IN (11, 12))
    AND NOT EXISTS (
      SELECT 1
      FROM "job_assignments" AS assignment
      WHERE assignment."job_id" = job."id"
        AND assignment."active" = true
        AND assignment."assignment_role" = 'STAFF'
        AND EXISTS (
          SELECT 1 FROM "users" AS assigned_user
          WHERE assigned_user."id" = assignment."user_id" AND assigned_user."active" = true
        )
    )
) AS exception_count
WHERE admin_user."active" = true
  AND admin_user."role" = 'ADMIN'
  AND exception_count."count" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "notifications" AS existing_warning
    WHERE existing_warning."recipient_id" = admin_user."id"
      AND existing_warning."type" = 'MISSING_STAFF'::"NotificationType"
      AND existing_warning."job_id" IS NULL
      AND existing_warning."read_at" IS NULL
  );

INSERT INTO "notifications" ("id", "recipient_id", "type", "title", "body", "href")
SELECT
  gen_random_uuid()::text,
  admin_user."id",
  'MISSING_SUPERVISOR'::"NotificationType",
  'Missing supervisor assignments',
  exception_count."count" || ' active jobs do not have an active supervisor assignment. Review the exception report now.',
  '/reports/exceptions?type=missing_supervisor'
FROM "users" AS admin_user
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS "count"
  FROM "jobs" AS job
  WHERE job."archived" = false
    AND (job."job_state_number" IS NULL OR job."job_state_number" NOT IN (11, 12))
    AND NOT EXISTS (
      SELECT 1
      FROM "job_assignments" AS assignment
      WHERE assignment."job_id" = job."id"
        AND assignment."active" = true
        AND assignment."assignment_role" = 'SUPERVISOR'
        AND EXISTS (
          SELECT 1 FROM "users" AS assigned_user
          WHERE assigned_user."id" = assignment."user_id" AND assigned_user."active" = true
        )
    )
) AS exception_count
WHERE admin_user."active" = true
  AND admin_user."role" = 'ADMIN'
  AND exception_count."count" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "notifications" AS existing_warning
    WHERE existing_warning."recipient_id" = admin_user."id"
      AND existing_warning."type" = 'MISSING_SUPERVISOR'::"NotificationType"
      AND existing_warning."job_id" IS NULL
      AND existing_warning."read_at" IS NULL
  );

CREATE UNIQUE INDEX "notifications_one_unread_assignment_exception_summary_idx"
ON "notifications" ("recipient_id", "type")
WHERE "read_at" IS NULL
  AND "job_id" IS NULL
  AND "type" IN ('MISSING_STAFF', 'MISSING_SUPERVISOR');
