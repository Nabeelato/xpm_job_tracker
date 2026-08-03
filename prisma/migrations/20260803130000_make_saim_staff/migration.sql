DO $$
DECLARE
  saim_id TEXT;
BEGIN
  SELECT id INTO saim_id
  FROM users
  WHERE username = 'saim.amjad'
  LIMIT 1;

  IF saim_id IS NOT NULL THEN
    UPDATE job_assignments AS assignment
    SET assignment_role = 'STAFF', updated_at = CURRENT_TIMESTAMP
    WHERE assignment.user_id = saim_id
      AND assignment.active = TRUE
      AND assignment.assignment_role = 'SUPERVISOR'
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments AS occupied
        WHERE occupied.job_id = assignment.job_id
          AND occupied.active = TRUE
          AND occupied.assignment_role = 'STAFF'
          AND occupied.user_id <> saim_id
      );

    UPDATE job_assignments
    SET active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = saim_id
      AND active = TRUE
      AND assignment_role <> 'STAFF';

    UPDATE users
    SET supervisor_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE supervisor_id = saim_id;

    UPDATE users
    SET role = 'STAFF', supervisor_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = saim_id;
  END IF;
END $$;
