ALTER TYPE "NotificationType" ADD VALUE 'BK_DEPARTMENT_CONFLICT';

ALTER TABLE "notifications"
ADD COLUMN "client_id" TEXT;

CREATE INDEX "notifications_client_id_idx" ON "notifications"("client_id");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- State 07 is outside the standard 03-06 workflow and must not retain timer history.
DELETE FROM "job_state_time_records" WHERE "state_number" = 7;

ALTER TABLE "job_state_time_records"
DROP CONSTRAINT "job_state_time_records_state_number_check";

ALTER TABLE "job_state_time_records"
ADD CONSTRAINT "job_state_time_records_state_number_check"
CHECK ("state_number" BETWEEN 1 AND 6);
