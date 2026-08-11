UPDATE users AS saim
SET supervisor_id = manager.id,
    updated_at = CURRENT_TIMESTAMP
FROM users AS manager
WHERE saim.username = 'saim.amjad'
  AND saim.role = 'STAFF'
  AND manager.username = 'irfan.tanwir'
  AND manager.active = TRUE
  AND manager.role IN ('ADMIN', 'MANAGER');
