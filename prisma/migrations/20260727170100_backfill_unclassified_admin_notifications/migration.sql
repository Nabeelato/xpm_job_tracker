INSERT INTO "notifications" (
  "id",
  "recipient_id",
  "type",
  "title",
  "body",
  "href",
  "job_id"
)
SELECT
  gen_random_uuid()::text,
  admin_user."id",
  'UNCLASSIFIED_JOB'::"NotificationType",
  'Unclassified job requires review',
  CASE
    WHEN NULLIF(BTRIM(job."source_manager_name"), '') IS NULL THEN
      job."job_id_from_excel" || ' was imported into Unclassified. No XPM manager was assigned and the job details did not match a department rule. Please review and assign the correct department.'
    ELSE
      job."job_id_from_excel" || ' was imported into Unclassified. XPM manager "' || job."source_manager_name" || '" and the job details did not match a department rule. Please review and assign the correct department.'
  END,
  '/jobs/' || job."id",
  job."id"
FROM "users" AS admin_user
CROSS JOIN "jobs" AS job
INNER JOIN "departments" AS department ON department."id" = job."final_department_id"
WHERE admin_user."active" = true
  AND admin_user."role" = 'ADMIN'
  AND department."code" = 'UNCLASSIFIED'
  AND NOT EXISTS (
    SELECT 1
    FROM "notifications" AS existing_warning
    WHERE existing_warning."recipient_id" = admin_user."id"
      AND existing_warning."job_id" = job."id"
      AND existing_warning."type" = 'UNCLASSIFIED_JOB'::"NotificationType"
      AND existing_warning."read_at" IS NULL
  );
