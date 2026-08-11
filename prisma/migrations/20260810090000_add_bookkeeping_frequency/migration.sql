-- Add a manual monthly/quarterly classification for Software Bookkeeping jobs.
-- The column is nullable so all existing jobs remain valid and unclassified.
CREATE TYPE "BookkeepingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');

ALTER TABLE "jobs"
ADD COLUMN "bookkeeping_frequency" "BookkeepingFrequency";

CREATE INDEX "jobs_final_department_id_bookkeeping_frequency_idx"
ON "jobs"("final_department_id", "bookkeeping_frequency");
