const fs = require("fs");
const path = require("path");
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

function loadEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;

  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^"|"$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function desiredCategoryForManagers(irfanJobs, taahaJobs) {
  if (irfanJobs > 0 && taahaJobs > 0) return "CONFLICT";
  if (irfanJobs > 0) return "SOFTWARE";
  if (taahaJobs > 0) return "MANUAL";
  return null;
}

async function main() {
  loadEnvIfNeeded();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Run this script from the project root with a valid production .env file.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

  try {
    const clientRows = await prisma.$queryRaw(Prisma.sql`
      WITH matched_jobs AS (
        SELECT
          c.id AS client_id,
          c.display_name,
          c.category,
          j.id AS job_id,
          j.job_id_from_excel,
          j.job_name,
          j.source_manager_name,
          d.code AS final_department_code
        FROM jobs j
        JOIN clients c ON c.id = j.client_id
        LEFT JOIN departments d ON d.id = j.final_department_id
        WHERE j.source_manager_name ILIKE '%irfan tanvir%'
           OR j.source_manager_name ILIKE '%taaha sheikh%'
      )
      SELECT
        client_id,
        display_name,
        category,
        COUNT(*) FILTER (WHERE source_manager_name ILIKE '%irfan tanvir%')::int AS irfan_jobs,
        COUNT(*) FILTER (WHERE source_manager_name ILIKE '%taaha sheikh%')::int AS taaha_jobs,
        COUNT(*)::int AS matched_jobs
      FROM matched_jobs
      GROUP BY client_id, display_name, category
      ORDER BY matched_jobs DESC, display_name ASC;
    `);

    const jobRows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        j.job_id_from_excel AS "jobIdFromExcel",
        j.job_name AS "jobName",
        c.display_name AS "clientName",
        j.source_manager_name AS "sourceManagerName",
        COALESCE(d.code, 'UNCLASSIFIED') AS "finalDepartmentCode"
      FROM jobs j
      JOIN clients c ON c.id = j.client_id
      LEFT JOIN departments d ON d.id = j.final_department_id
      WHERE j.source_manager_name ILIKE '%irfan tanvir%'
         OR j.source_manager_name ILIKE '%taaha sheikh%'
      ORDER BY c.display_name ASC, j.job_id_from_excel ASC;
    `);

    const summary = {
      totalMatchedClients: clientRows.length,
      clientsThatWouldChange: clientRows.filter((row) => {
        const desired = desiredCategoryForManagers(Number(row.irfan_jobs), Number(row.taaha_jobs));
        return desired && desired !== "CONFLICT" && row.category !== desired;
      }).length,
      conflictClients: clientRows.filter((row) => desiredCategoryForManagers(Number(row.irfan_jobs), Number(row.taaha_jobs)) === "CONFLICT").length,
      totalMatchedJobs: jobRows.length,
    };

    const clientPreview = clientRows.map((row) => {
      const desired = desiredCategoryForManagers(Number(row.irfan_jobs), Number(row.taaha_jobs));
      return {
        clientId: row.client_id,
        clientName: row.display_name,
        currentCategory: row.category,
        desiredCategory: desired,
        irfanJobs: Number(row.irfan_jobs),
        taahaJobs: Number(row.taaha_jobs),
        matchedJobs: Number(row.matched_jobs),
      };
    });

    console.log(
      JSON.stringify(
        {
          summary,
          clients: clientPreview,
          jobs: jobRows,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});