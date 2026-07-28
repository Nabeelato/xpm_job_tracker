ALTER TYPE "NotificationType" ADD VALUE 'MISSING_STAFF';
ALTER TYPE "NotificationType" ADD VALUE 'MISSING_SUPERVISOR';

WITH ranked_assignments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "job_id", "assignment_role"
      ORDER BY "assigned_at" DESC, "created_at" DESC, "id" DESC
    ) AS assignment_rank
  FROM "job_assignments"
  WHERE "active" = true
    AND "assignment_role" IN ('STAFF', 'SUPERVISOR')
)
UPDATE "job_assignments" AS assignment
SET "active" = false,
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_assignments AS ranked
WHERE assignment."id" = ranked."id"
  AND ranked.assignment_rank > 1;

CREATE UNIQUE INDEX "job_assignments_one_active_staff_per_job_idx"
ON "job_assignments" ("job_id")
WHERE "active" = true AND "assignment_role" = 'STAFF';

CREATE UNIQUE INDEX "job_assignments_one_active_supervisor_per_job_idx"
ON "job_assignments" ("job_id")
WHERE "active" = true AND "assignment_role" = 'SUPERVISOR';
