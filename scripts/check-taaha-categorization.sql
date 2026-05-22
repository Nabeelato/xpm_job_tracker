-- How many visible (non-archived) jobs would render with the SOFTWARE-client tint?
SELECT COUNT(*) AS software_visible_jobs
FROM jobs j
JOIN clients c ON c.id = j.client_id
WHERE c.category = 'SOFTWARE' AND j.archived = false;

-- Of the first page of /jobs (default sort), how many are software-client jobs?
SELECT j.job_id_from_excel, c.display_name, c.category, j.archived, j.updated_at, j.missing_from_latest_import
FROM jobs j
JOIN clients c ON c.id = j.client_id
WHERE j.archived = false
ORDER BY j.missing_from_latest_import DESC, j.updated_at DESC
LIMIT 25;
