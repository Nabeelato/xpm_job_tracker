WITH client_conflicts AS (
  SELECT
    job."client_id",
    BOOL_OR(department."code" = 'BK') AS "has_bk",
    BOOL_OR(department."code" = 'SOFTWARE_BK') AS "has_software_bk",
    BOOL_OR(job."source_partner_name" ~* '\mtaaha\s+(imran|sheikh)\M') AS "has_taaha_partner",
    BOOL_OR(job."source_partner_name" ~* '\mirfan\s+tan(v|w)ir\M') AS "has_irfan_partner"
  FROM "jobs" AS job
  JOIN "departments" AS department ON department."id" = job."final_department_id"
  WHERE job."archived" = FALSE
  GROUP BY job."client_id"
  HAVING
    (BOOL_OR(department."code" = 'BK') AND BOOL_OR(department."code" = 'SOFTWARE_BK'))
    OR (
      BOOL_OR(job."source_partner_name" ~* '\mtaaha\s+(imran|sheikh)\M')
      AND BOOL_OR(job."source_partner_name" ~* '\mirfan\s+tan(v|w)ir\M')
    )
),
alert_rows AS (
  SELECT
    recipient."id" AS "recipient_id",
    client."id" AS "client_id",
    client."display_name",
    conflict."has_bk",
    conflict."has_software_bk",
    conflict."has_taaha_partner",
    conflict."has_irfan_partner"
  FROM client_conflicts AS conflict
  JOIN "clients" AS client ON client."id" = conflict."client_id"
  CROSS JOIN "users" AS recipient
  WHERE recipient."active" = TRUE
)
INSERT INTO "notifications" (
  "id",
  "recipient_id",
  "type",
  "title",
  "body",
  "href",
  "client_id",
  "created_at"
)
SELECT
  'bk-conflict-' || MD5(alert."recipient_id" || ':' || alert."client_id"),
  alert."recipient_id",
  'BK_DEPARTMENT_CONFLICT'::"NotificationType",
  'Confirm BK or Software BK department',
  alert."display_name" || ' needs a department confirmation because ' ||
    CASE
      WHEN alert."has_bk" AND alert."has_software_bk" AND alert."has_taaha_partner" AND alert."has_irfan_partner"
        THEN 'its active jobs are currently split between BK and Software BK and its active jobs include both Taaha and Irfan as XPM source partners'
      WHEN alert."has_bk" AND alert."has_software_bk"
        THEN 'its active jobs are currently split between BK and Software BK'
      ELSE 'its active jobs include both Taaha and Irfan as XPM source partners'
    END ||
    '. Please review the affected jobs and confirm whether each belongs in BK or Software BK.',
  '/clients/' || alert."client_id",
  alert."client_id",
  CURRENT_TIMESTAMP
FROM alert_rows AS alert
WHERE NOT EXISTS (
  SELECT 1
  FROM "notifications" AS existing
  WHERE existing."recipient_id" = alert."recipient_id"
    AND existing."client_id" = alert."client_id"
    AND existing."type" = 'BK_DEPARTMENT_CONFLICT'::"NotificationType"
    AND existing."read_at" IS NULL
)
ON CONFLICT ("id") DO NOTHING;
