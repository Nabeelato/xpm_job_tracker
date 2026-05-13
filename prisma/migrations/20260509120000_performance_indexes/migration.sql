CREATE INDEX "clients_display_name_idx" ON "clients"("display_name");

CREATE INDEX "jobs_archived_updated_at_idx" ON "jobs"("archived", "updated_at");
CREATE INDEX "jobs_missing_from_latest_import_updated_at_idx" ON "jobs"("missing_from_latest_import", "updated_at");
CREATE INDEX "jobs_job_state_number_state_entered_at_idx" ON "jobs"("job_state_number", "state_entered_at");
CREATE INDEX "jobs_final_department_id_updated_at_idx" ON "jobs"("final_department_id", "updated_at");
CREATE INDEX "jobs_client_id_updated_at_idx" ON "jobs"("client_id", "updated_at");

CREATE INDEX "job_assignments_job_id_active_idx" ON "job_assignments"("job_id", "active");
CREATE INDEX "job_assignments_user_id_active_job_id_idx" ON "job_assignments"("user_id", "active", "job_id");

CREATE INDEX "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");
