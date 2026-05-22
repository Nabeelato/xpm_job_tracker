-- Simplify AssignmentRole to just MANAGER and SUPERVISOR.
-- PRIMARY rows become MANAGER (rename). REVIEWER and HELPER rows are deleted.

-- 1. Drop REVIEWER and HELPER assignment rows entirely (history not preserved for these legacy roles).
DELETE FROM "job_assignments" WHERE "assignment_role" IN ('REVIEWER', 'HELPER');

-- 2. Create the new enum.
CREATE TYPE "AssignmentRole_new" AS ENUM ('MANAGER', 'SUPERVISOR');

-- 3. Migrate the column: PRIMARY -> MANAGER, SUPERVISOR -> SUPERVISOR.
ALTER TABLE "job_assignments"
  ALTER COLUMN "assignment_role" TYPE "AssignmentRole_new"
  USING (
    CASE "assignment_role"::text
      WHEN 'PRIMARY'    THEN 'MANAGER'::"AssignmentRole_new"
      WHEN 'SUPERVISOR' THEN 'SUPERVISOR'::"AssignmentRole_new"
    END
  );

-- 4. Drop old enum and rename the new one to its final name.
DROP TYPE "AssignmentRole";
ALTER TYPE "AssignmentRole_new" RENAME TO "AssignmentRole";
