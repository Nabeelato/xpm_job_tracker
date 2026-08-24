CREATE TYPE "StaffJobStatus" AS ENUM ('DONE');

ALTER TABLE "job_assignments"
ADD COLUMN "staff_status" "StaffJobStatus",
ADD COLUMN "staff_comment" TEXT,
ADD COLUMN "staff_status_updated_at" TIMESTAMP(3);

CREATE INDEX "job_assignments_staff_status_idx" ON "job_assignments"("staff_status");
