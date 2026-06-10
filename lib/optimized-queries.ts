import { Prisma, type BookkeepingBy, type BookkeepingSoftware, type ClientCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSessionUser } from "@/lib/rbac";

export type DashboardMetrics = {
  totalJobs: number;
  totalClients: number;
  clientsWithMultipleJobs: number;
  mainJobs: number;
  vatJobs: number;
  softwareBkJobs: number;
  bkJobs: number;
  afsJobs: number;
  unclassifiedJobs: number;
  unassignedJobs: number;
  missingJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  ifzaCheckJobs: number;
};

export type ClientFilter =
  | "multiple"
  | "vat"
  | "software_bk"
  | "bk"
  | "afs"
  | "vat_bk"
  | "vat_afs"
  | "bk_afs"
  | "all_3"
  | "unclassified"
  | "missing"
  | "category_software"
  | "category_manual"
  | "category_uncategorized";

export type ClientSummary = {
  id: string;
  displayName: string;
  category: ClientCategory | null;
  bookkeepingSoftware: BookkeepingSoftware | null;
  bookkeepingBy: BookkeepingBy | null;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  missingJobs: number;
  departmentCounts: Record<string, number>;
};

type CountValue = number | bigint | string | null;

type DashboardMetricsRow = Record<keyof DashboardMetrics, CountValue>;


type ClientSummaryRow = {
  id: string;
  displayName: string;
  category: ClientCategory | null;
  bookkeepingSoftware: BookkeepingSoftware | null;
  bookkeepingBy: BookkeepingBy | null;
  totalJobs: CountValue;
  activeJobs: CountValue;
  completedJobs: CountValue;
  missingJobs: CountValue;
  vatJobs: CountValue;
  softwareBkJobs: CountValue;
  bkJobs: CountValue;
  afsJobs: CountValue;
  qcJobs: CountValue;
  unclassifiedJobs: CountValue;
  totalCount: CountValue;
};

function toNumber(value: CountValue) {
  return Number(value ?? 0);
}

function visibleJobsSql(user: AppSessionUser) {
  if (user.role === "ADMIN" || user.departmentCode === "QC") return Prisma.sql`TRUE`;

  return Prisma.sql`EXISTS (
    SELECT 1
    FROM job_assignments visible_assignment
    WHERE visible_assignment.job_id = j.id
      AND visible_assignment.user_id = ${user.id}
      AND visible_assignment.active = TRUE
  )`;
}

function clientFilterSql(filter?: ClientFilter | string | null) {
  if (filter === "multiple") return Prisma.sql`WHERE "totalJobs" > 1`;
  if (filter === "vat") return Prisma.sql`WHERE "vatJobs" > 0`;
  if (filter === "software_bk") return Prisma.sql`WHERE "softwareBkJobs" > 0`;
  if (filter === "bk") return Prisma.sql`WHERE "bkJobs" > 0`;
  if (filter === "afs") return Prisma.sql`WHERE "afsJobs" > 0`;
  if (filter === "vat_bk") return Prisma.sql`WHERE "vatJobs" > 0 AND "bkJobs" > 0`;
  if (filter === "vat_afs") return Prisma.sql`WHERE "vatJobs" > 0 AND "afsJobs" > 0`;
  if (filter === "bk_afs") return Prisma.sql`WHERE "bkJobs" > 0 AND "afsJobs" > 0`;
  if (filter === "all_3") return Prisma.sql`WHERE "vatJobs" > 0 AND "bkJobs" > 0 AND "afsJobs" > 0`;
  if (filter === "unclassified") return Prisma.sql`WHERE "unclassifiedJobs" > 0`;
  if (filter === "missing") return Prisma.sql`WHERE "missingJobs" > 0`;
  if (filter === "category_software") return Prisma.sql`WHERE "category" = 'SOFTWARE'`;
  if (filter === "category_manual") return Prisma.sql`WHERE "category" = 'MANUAL'`;
  if (filter === "category_uncategorized") return Prisma.sql`WHERE "category" IS NULL`;

  return Prisma.empty;
}

export async function getDashboardMetrics(user: AppSessionUser): Promise<DashboardMetrics> {
  const [row] = await prisma.$queryRaw<DashboardMetricsRow[]>(Prisma.sql`
    WITH visible_jobs AS (
      SELECT
        j.id,
        j.client_id,
        j.job_state_number,
        j.xpm_state,
        j.internal_status::text AS internal_status,
        j.missing_from_latest_import,
        j.state_entered_at,
        d.code AS department_code
      FROM jobs j
      JOIN departments d ON d.id = j.final_department_id
      WHERE ${visibleJobsSql(user)}
    ),
    client_counts AS (
      SELECT client_id, COUNT(*) AS job_count
      FROM visible_jobs
      GROUP BY client_id
    )
    SELECT
      COUNT(*)::int AS "totalJobs",
      (SELECT COUNT(*)::int FROM client_counts) AS "totalClients",
      (SELECT COUNT(*)::int FROM client_counts WHERE job_count > 1) AS "clientsWithMultipleJobs",
      (COUNT(*) FILTER (WHERE job_state_number IN (2, 3, 4, 5, 6)))::int AS "mainJobs",
      (COUNT(*) FILTER (WHERE department_code = 'VAT' AND job_state_number IN (3, 4, 5, 6)))::int AS "vatJobs",
      (COUNT(*) FILTER (WHERE department_code = 'SOFTWARE_BK' AND job_state_number IN (3, 4, 5, 6)))::int AS "softwareBkJobs",
      (COUNT(*) FILTER (WHERE department_code = 'BK' AND job_state_number IN (3, 4, 5, 6)))::int AS "bkJobs",
      (COUNT(*) FILTER (WHERE department_code = 'AFS' AND job_state_number IN (3, 4, 5, 6)))::int AS "afsJobs",
      (COUNT(*) FILTER (WHERE department_code = 'UNCLASSIFIED' AND job_state_number IN (3, 4, 5, 6)))::int AS "unclassifiedJobs",
      (COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1
          FROM job_assignments active_assignment
          WHERE active_assignment.job_id = visible_jobs.id
            AND active_assignment.active = TRUE
        )
      ))::int AS "unassignedJobs",
      (COUNT(*) FILTER (WHERE missing_from_latest_import = TRUE))::int AS "missingJobs",
      (COUNT(*) FILTER (WHERE job_state_number = 11))::int AS "completedJobs",
      (COUNT(*) FILTER (WHERE job_state_number = 12))::int AS "cancelledJobs",
      (COUNT(*) FILTER (WHERE xpm_state LIKE '%3.2%'))::int AS "ifzaCheckJobs"
    FROM visible_jobs
  `);

  return {
    totalJobs: toNumber(row?.totalJobs),
    totalClients: toNumber(row?.totalClients),
    clientsWithMultipleJobs: toNumber(row?.clientsWithMultipleJobs),
    mainJobs: toNumber(row?.mainJobs),
    vatJobs: toNumber(row?.vatJobs),
    softwareBkJobs: toNumber(row?.softwareBkJobs),
    bkJobs: toNumber(row?.bkJobs),
    afsJobs: toNumber(row?.afsJobs),
    unclassifiedJobs: toNumber(row?.unclassifiedJobs),
    unassignedJobs: toNumber(row?.unassignedJobs),
    missingJobs: toNumber(row?.missingJobs),
    completedJobs: toNumber(row?.completedJobs),
    cancelledJobs: toNumber(row?.cancelledJobs),
    ifzaCheckJobs: toNumber(row?.ifzaCheckJobs),
  };
}

export async function getClientSummaries({
  user,
  query,
  filter,
  page,
  pageSize,
}: {
  user: AppSessionUser;
  query?: string;
  filter?: ClientFilter | string | null;
  page: number;
  pageSize: number;
}) {
  const offset = Math.max(0, (page - 1) * pageSize);
  const searchPattern = query ? `%${query}%` : "";
  const searchSql = query
    ? Prisma.sql`AND (c.display_name ILIKE ${searchPattern} OR c.source_client_name ILIKE ${searchPattern})`
    : Prisma.empty;
  const filterSql = clientFilterSql(filter);

  const rows = await prisma.$queryRaw<ClientSummaryRow[]>(Prisma.sql`
    WITH visible_client_jobs AS (
      SELECT
        c.id,
        c.display_name,
        c.category,
        c.bookkeeping_software,
        c.bookkeeping_by,
        j.archived,
        j.internal_status::text AS internal_status,
        j.missing_from_latest_import,
        j.job_state_number,
        j.state_entered_at,
        d.code AS department_code
      FROM clients c
      JOIN jobs j ON j.client_id = c.id
      JOIN departments d ON d.id = j.final_department_id
      WHERE ${visibleJobsSql(user)}
      ${searchSql}
    ),
    client_summaries AS (
      SELECT
        id,
        display_name AS "displayName",
        category,
        bookkeeping_software AS "bookkeepingSoftware",
        bookkeeping_by AS "bookkeepingBy",
        COUNT(*)::int AS "totalJobs",
        (COUNT(*) FILTER (WHERE archived = FALSE))::int AS "activeJobs",
        (COUNT(*) FILTER (WHERE internal_status = 'COMPLETED'))::int AS "completedJobs",
        (COUNT(*) FILTER (WHERE missing_from_latest_import = TRUE))::int AS "missingJobs",
        (COUNT(*) FILTER (WHERE department_code = 'VAT' AND job_state_number IN (3, 4, 5, 6)))::int AS "vatJobs",
        (COUNT(*) FILTER (WHERE department_code = 'SOFTWARE_BK' AND job_state_number IN (3, 4, 5, 6)))::int AS "softwareBkJobs",
        (COUNT(*) FILTER (WHERE department_code = 'BK' AND job_state_number IN (3, 4, 5, 6)))::int AS "bkJobs",
        (COUNT(*) FILTER (WHERE department_code = 'AFS' AND job_state_number IN (3, 4, 5, 6)))::int AS "afsJobs",
        (COUNT(*) FILTER (WHERE department_code = 'QC' AND job_state_number IN (3, 4, 5, 6)))::int AS "qcJobs",
        (COUNT(*) FILTER (WHERE department_code = 'UNCLASSIFIED' AND job_state_number IN (3, 4, 5, 6)))::int AS "unclassifiedJobs"
      FROM visible_client_jobs
      GROUP BY id, display_name, category, bookkeeping_software, bookkeeping_by
    ),
    filtered AS (
      SELECT *
      FROM client_summaries
      ${filterSql}
    )
    SELECT
      *,
      (COUNT(*) OVER())::int AS "totalCount"
    FROM filtered
    ORDER BY "displayName" ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `);

  return {
    total: toNumber(rows[0]?.totalCount),
    summaries: rows.map((row): ClientSummary => ({
      id: row.id,
      displayName: row.displayName,
      category: row.category,
      bookkeepingSoftware: row.bookkeepingSoftware,
      bookkeepingBy: row.bookkeepingBy,
      totalJobs: toNumber(row.totalJobs),
      activeJobs: toNumber(row.activeJobs),
      completedJobs: toNumber(row.completedJobs),
      missingJobs: toNumber(row.missingJobs),
      departmentCounts: {
        VAT: toNumber(row.vatJobs),
        SOFTWARE_BK: toNumber(row.softwareBkJobs),
        BK: toNumber(row.bkJobs),
        AFS: toNumber(row.afsJobs),
        QC: toNumber(row.qcJobs),
        UNCLASSIFIED: toNumber(row.unclassifiedJobs),
      },
    })),
  };
}
