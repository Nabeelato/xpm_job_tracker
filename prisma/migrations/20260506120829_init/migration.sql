-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'STAFF');

-- CreateEnum
CREATE TYPE "InternalStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'CHANGES_REQUIRED', 'COMPLETED', 'ON_HOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('PRIMARY', 'REVIEWER', 'SUPERVISOR', 'HELPER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('STAGED', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowAction" AS ENUM ('NEW_JOB', 'UPDATE_JOB', 'UNCHANGED', 'DUPLICATE_IN_FILE', 'ERROR');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('IMPORT', 'USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "supervisor_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_client_key" TEXT NOT NULL,
    "source_client_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "job_id_from_excel" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "priority" TEXT,
    "xpm_state" TEXT,
    "source_manager_name" TEXT,
    "source_partner_name" TEXT,
    "auto_detected_department_id" TEXT,
    "final_department_id" TEXT NOT NULL,
    "department_manually_overridden" BOOLEAN NOT NULL DEFAULT false,
    "internal_status" "InternalStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "missing_from_latest_import" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_import_batch_id" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_from_import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_role" "AssignmentRole" NOT NULL,
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL DEFAULT 'STAGED',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "new_clients_count" INTEGER NOT NULL DEFAULT 0,
    "matched_clients_count" INTEGER NOT NULL DEFAULT 0,
    "new_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "updated_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "missing_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "vat_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "bk_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "afs_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "unclassified_jobs_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows_count" INTEGER NOT NULL DEFAULT 0,
    "error_rows_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data_json" JSONB NOT NULL,
    "detected_job_id" TEXT,
    "detected_client_name" TEXT,
    "detected_job_name" TEXT,
    "detected_department_code" TEXT,
    "action" "ImportRowAction" NOT NULL,
    "error_message" TEXT,
    "matched_client_id" TEXT,
    "matched_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_change_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "import_batch_id" TEXT,
    "changed_by_id" TEXT,
    "change_source" "ChangeSource" NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_comments" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_supervisor_id_idx" ON "users"("supervisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_normalized_client_key_key" ON "clients"("normalized_client_key");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_job_id_from_excel_key" ON "jobs"("job_id_from_excel");

-- CreateIndex
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");

-- CreateIndex
CREATE INDEX "jobs_final_department_id_idx" ON "jobs"("final_department_id");

-- CreateIndex
CREATE INDEX "jobs_internal_status_idx" ON "jobs"("internal_status");

-- CreateIndex
CREATE INDEX "jobs_xpm_state_idx" ON "jobs"("xpm_state");

-- CreateIndex
CREATE INDEX "jobs_missing_from_latest_import_idx" ON "jobs"("missing_from_latest_import");

-- CreateIndex
CREATE INDEX "job_assignments_job_id_idx" ON "job_assignments"("job_id");

-- CreateIndex
CREATE INDEX "job_assignments_user_id_idx" ON "job_assignments"("user_id");

-- CreateIndex
CREATE INDEX "job_assignments_assigned_by_id_idx" ON "job_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "import_batches_uploaded_by_id_idx" ON "import_batches"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_rows_import_batch_id_idx" ON "import_rows"("import_batch_id");

-- CreateIndex
CREATE INDEX "import_rows_matched_client_id_idx" ON "import_rows"("matched_client_id");

-- CreateIndex
CREATE INDEX "import_rows_matched_job_id_idx" ON "import_rows"("matched_job_id");

-- CreateIndex
CREATE INDEX "job_change_logs_job_id_idx" ON "job_change_logs"("job_id");

-- CreateIndex
CREATE INDEX "job_change_logs_import_batch_id_idx" ON "job_change_logs"("import_batch_id");

-- CreateIndex
CREATE INDEX "job_change_logs_changed_by_id_idx" ON "job_change_logs"("changed_by_id");

-- CreateIndex
CREATE INDEX "job_comments_job_id_idx" ON "job_comments"("job_id");

-- CreateIndex
CREATE INDEX "job_comments_user_id_idx" ON "job_comments"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_auto_detected_department_id_fkey" FOREIGN KEY ("auto_detected_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_final_department_id_fkey" FOREIGN KEY ("final_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_last_seen_import_batch_id_fkey" FOREIGN KEY ("last_seen_import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_from_import_batch_id_fkey" FOREIGN KEY ("created_from_import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_matched_client_id_fkey" FOREIGN KEY ("matched_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_matched_job_id_fkey" FOREIGN KEY ("matched_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_logs" ADD CONSTRAINT "job_change_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_logs" ADD CONSTRAINT "job_change_logs_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_change_logs" ADD CONSTRAINT "job_change_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_comments" ADD CONSTRAINT "job_comments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_comments" ADD CONSTRAINT "job_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
