-- 1. Drop the auto-assignment table (department defaults).
DROP TABLE IF EXISTS "department_default_assignees";

-- 2. Collapse AssignmentSource enum to just MANUAL.
--    Any existing AUTO_DEPARTMENT / AUTO_QC rows become MANUAL.
CREATE TYPE "AssignmentSource_new" AS ENUM ('MANUAL');
ALTER TABLE "job_assignments" ALTER COLUMN "assignment_source" DROP DEFAULT;
ALTER TABLE "job_assignments"
  ALTER COLUMN "assignment_source" TYPE "AssignmentSource_new"
  USING ('MANUAL'::"AssignmentSource_new");
ALTER TABLE "job_assignments" ALTER COLUMN "assignment_source" SET DEFAULT 'MANUAL';
DROP TYPE "AssignmentSource";
ALTER TYPE "AssignmentSource_new" RENAME TO "AssignmentSource";

-- 3. Add client category (nullable; admins set it from the client detail page).
CREATE TYPE "ClientCategory" AS ENUM ('SOFTWARE', 'MANUAL');
ALTER TABLE "clients" ADD COLUMN "category" "ClientCategory";
CREATE INDEX "clients_category_idx" ON "clients"("category");
