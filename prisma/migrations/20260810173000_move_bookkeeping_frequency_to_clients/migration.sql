-- Store the bookkeeping cycle once per client so every Software BK job inherits it.
ALTER TABLE "clients"
ADD COLUMN "bookkeeping_frequency" "BookkeepingFrequency";

-- Preserve any value entered during the short-lived job-level implementation.
-- A client is copied only when all categorized jobs agree on the same cycle.
UPDATE "clients" AS client
SET "bookkeeping_frequency" = agreed_frequency."frequency"
FROM (
  SELECT
    "client_id",
    MIN("bookkeeping_frequency"::text)::"BookkeepingFrequency" AS "frequency"
  FROM "jobs"
  WHERE "bookkeeping_frequency" IS NOT NULL
  GROUP BY "client_id"
  HAVING COUNT(DISTINCT "bookkeeping_frequency") = 1
) AS agreed_frequency
WHERE client."id" = agreed_frequency."client_id";

DROP INDEX "jobs_final_department_id_bookkeeping_frequency_idx";

ALTER TABLE "jobs"
DROP COLUMN "bookkeeping_frequency";

CREATE INDEX "clients_bookkeeping_frequency_idx"
ON "clients"("bookkeeping_frequency");
