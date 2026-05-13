-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'AUTO_DEPARTMENT', 'AUTO_QC');

-- CreateEnum
CREATE TYPE "ImportStateComparisonCategory" AS ENUM ('NOT_APPLICABLE', 'NEW_MAIN', 'STATE_UPDATED', 'STATE_UNCHANGED', 'MOVED_OUT_OF_MAIN', 'COMPLETED', 'CANCELLED', 'MISSING_FROM_UPLOAD');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMENT', 'ASSIGNMENT_ADDED', 'ASSIGNMENT_REMOVED', 'DIARY_ENTRY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "department_id" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "job_state_number" INTEGER;
ALTER TABLE "jobs" ADD COLUMN "state_entered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_assignments" ADD COLUMN "assignment_source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN "software_bk_jobs_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "state_updated_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "state_unchanged_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "moved_out_of_main_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "completed_state_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "cancelled_state_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "import_rows" ADD COLUMN "previous_xpm_state" TEXT;
ALTER TABLE "import_rows" ADD COLUMN "new_xpm_state" TEXT;
ALTER TABLE "import_rows" ADD COLUMN "previous_state_number" INTEGER;
ALTER TABLE "import_rows" ADD COLUMN "new_state_number" INTEGER;
ALTER TABLE "import_rows" ADD COLUMN "state_comparison_category" "ImportStateComparisonCategory" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- CreateTable
CREATE TABLE "department_default_assignees" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_default_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "job_id" TEXT,
    "diary_entry_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "jobs_job_state_number_idx" ON "jobs"("job_state_number");

-- CreateIndex
CREATE INDEX "jobs_state_entered_at_idx" ON "jobs"("state_entered_at");

-- CreateIndex
CREATE INDEX "job_assignments_assignment_source_idx" ON "job_assignments"("assignment_source");

-- CreateIndex
CREATE UNIQUE INDEX "department_default_assignees_department_id_user_id_key" ON "department_default_assignees"("department_id", "user_id");

-- CreateIndex
CREATE INDEX "department_default_assignees_user_id_idx" ON "department_default_assignees"("user_id");

-- CreateIndex
CREATE INDEX "import_rows_state_comparison_category_idx" ON "import_rows"("state_comparison_category");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_job_id_idx" ON "notifications"("job_id");

-- CreateIndex
CREATE INDEX "notifications_diary_entry_id_idx" ON "notifications"("diary_entry_id");

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");

-- CreateIndex
CREATE INDEX "diary_entries_recipient_id_idx" ON "diary_entries"("recipient_id");

-- CreateIndex
CREATE INDEX "diary_entries_author_id_idx" ON "diary_entries"("author_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_default_assignees" ADD CONSTRAINT "department_default_assignees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_default_assignees" ADD CONSTRAINT "department_default_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
