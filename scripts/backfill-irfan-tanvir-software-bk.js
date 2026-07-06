const fs = require("fs");
const path = require("path");
const { PrismaClient, Prisma, ChangeSource } = require("@prisma/client");
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

async function main() {
  loadEnvIfNeeded();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Run this script from the project root with a valid production .env file.");
  }

  const applyChanges = process.argv.includes("--apply") || process.env.APPLY === "1";
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

  try {
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        j.id AS "jobId",
        j.job_id_from_excel AS "jobIdFromExcel",
        c.display_name AS "clientName",
        j.job_name AS "jobName",
        j.source_manager_name AS "sourceManagerName",
        j.department_manually_overridden AS "departmentManuallyOverridden",
        d.code AS "currentDepartmentCode"
      FROM jobs j
      JOIN clients c ON c.id = j.client_id
      LEFT JOIN departments d ON d.id = j.final_department_id
      WHERE j.source_manager_name ILIKE '%irfan tanvir%'
        AND d.code = 'BK'
      ORDER BY c.display_name ASC, j.job_id_from_excel ASC;
    `);

    const preview = rows.map((row) => ({
      jobId: row.jobId,
      jobIdFromExcel: row.jobIdFromExcel,
      clientName: row.clientName,
      jobName: row.jobName,
      sourceManagerName: row.sourceManagerName,
      currentDepartmentCode: row.currentDepartmentCode,
      targetDepartmentCode: "SOFTWARE_BK",
      departmentManuallyOverridden: row.departmentManuallyOverridden,
      wouldChange: true,
    }));

    if (!applyChanges) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            summary: {
              matchedJobs: preview.length,
              jobsThatWouldChange: preview.length,
            },
            jobs: preview,
          },
          null,
          2,
        ),
      );
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const softwareDepartment = await tx.department.findUnique({
        where: { code: "SOFTWARE_BK" },
        select: { id: true },
      });

      if (!softwareDepartment) {
        throw new Error("SOFTWARE_BK department is missing.");
      }

      let count = 0;
      for (const row of preview) {
        await tx.job.update({
          where: { id: row.jobId },
          data: {
            autoDetectedDepartmentId: softwareDepartment.id,
            finalDepartmentId: softwareDepartment.id,
            departmentManuallyOverridden: false,
          },
        });
        await tx.jobChangeLog.create({
          data: {
            jobId: row.jobId,
            changedById: null,
            changeSource: ChangeSource.SYSTEM,
            fieldName: "department_backfill",
            oldValue: row.currentDepartmentCode,
            newValue: "SOFTWARE_BK",
          },
        });
        count += 1;
      }

      return count;
    });

    console.log(
      JSON.stringify(
        {
          mode: "apply",
          summary: {
            matchedJobs: preview.length,
            updatedJobs: updated,
          },
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