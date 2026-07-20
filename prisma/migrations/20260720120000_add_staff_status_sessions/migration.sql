-- CreateEnum
CREATE TYPE "StaffStatusEndReason" AS ENUM ('USER_SWITCHED', 'USER_CLEARED', 'JOB_LEFT_WORKFLOW', 'ASSIGNMENT_ENDED');

-- CreateTable
CREATE TABLE "staff_status_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" "StaffStatusEndReason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_status_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_status_sessions_interval_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

-- CreateIndex
CREATE INDEX "staff_status_sessions_user_id_ended_at_idx" ON "staff_status_sessions"("user_id", "ended_at");

-- CreateIndex
CREATE INDEX "staff_status_sessions_user_id_started_at_idx" ON "staff_status_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "staff_status_sessions_job_id_ended_at_idx" ON "staff_status_sessions"("job_id", "ended_at");

-- At most one open (current) status per user.
CREATE UNIQUE INDEX "staff_status_sessions_one_open_per_user"
ON "staff_status_sessions"("user_id")
WHERE "ended_at" IS NULL;

-- AddForeignKey
ALTER TABLE "staff_status_sessions"
ADD CONSTRAINT "staff_status_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_status_sessions"
ADD CONSTRAINT "staff_status_sessions_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
