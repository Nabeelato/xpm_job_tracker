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

function normalizeManagerName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function targetForManager(managerName) {
  const normalized = normalizeManagerName(managerName);

  if (normalized.includes("irfan tanvir") || normalized.includes("irfan tanwir")) {
    return { clientCategory: "SOFTWARE", departmentCode: "SOFTWARE_BK" };
  }

  if (normalized.includes("taaha sheikh")) {
    return { clientCategory: "MANUAL", departmentCode: "BK" };
  }

  return null;
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
        j.id AS job_id,
        j.job_id_from_excel,
        j.job_name,
        j.source_manager_name,
        c.id AS client_id,
        c.display_name,
        c.category,
        c.bookkeeping_by,
        d.code AS final_department_code
      FROM jobs j
      JOIN clients c ON c.id = j.client_id
      LEFT JOIN departments d ON d.id = j.final_department_id
      WHERE j.source_manager_name ILIKE '%irfan tanvir%'
         OR j.source_manager_name ILIKE '%irfan tanwir%'
         OR j.source_manager_name ILIKE '%taaha sheikh%'
      ORDER BY c.display_name ASC, j.job_id_from_excel ASC;
    `);

    const clientTargets = new Map();
    const jobTargets = [];

    for (const row of rows) {
      const target = targetForManager(row.source_manager_name);
      if (!target) continue;

      const existingClient = clientTargets.get(row.client_id) ?? {
        clientId: row.client_id,
        clientName: row.display_name,
        currentCategory: row.category,
        currentBookkeepingBy: row.bookkeeping_by,
        hasIrfanJobs: false,
        hasTaahaJobs: false,
      };

      if (target.clientCategory === "SOFTWARE") {
        existingClient.hasIrfanJobs = true;
      } else if (target.clientCategory === "MANUAL") {
        existingClient.hasTaahaJobs = true;
      }

      clientTargets.set(row.client_id, existingClient);

      jobTargets.push({
        jobId: row.job_id,
        jobIdFromExcel: row.job_id_from_excel,
        clientName: row.display_name,
        jobName: row.job_name,
        sourceManagerName: row.source_manager_name,
        currentDepartmentCode: row.final_department_code || "UNCLASSIFIED",
        targetDepartmentCode: target.departmentCode,
      });
    }

    const previewClients = [...clientTargets.values()].map((row) => {
      const targetCategory = row.hasIrfanJobs ? "SOFTWARE" : row.hasTaahaJobs ? "MANUAL" : null;
      const targetBookkeepingBy = row.hasTaahaJobs ? "FIRM" : row.currentBookkeepingBy ?? null;
      return {
        ...row,
        targetCategory,
        targetBookkeepingBy,
        wouldChange: Boolean(targetCategory && targetCategory !== row.currentCategory),
        bookkeepingWouldChange: Boolean(targetBookkeepingBy && targetBookkeepingBy !== row.currentBookkeepingBy),
      };
    });

    const previewJobs = jobTargets.map((row) => ({
      ...row,
      wouldChange: row.currentDepartmentCode !== row.targetDepartmentCode,
    }));

    if (!applyChanges) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            summary: {
              matchedClients: previewClients.length,
              clientsThatWouldChange: previewClients.filter((row) => row.wouldChange).length,
              bookkeepingFieldsThatWouldChange: previewClients.filter((row) => row.bookkeepingWouldChange).length,
              matchedJobs: previewJobs.length,
              jobsThatWouldChange: previewJobs.filter((row) => row.wouldChange).length,
              softwareClientsToSet: previewClients.filter((row) => row.targetCategory === "SOFTWARE" && row.wouldChange).length,
              manualClientsToSet: previewClients.filter((row) => row.targetCategory === "MANUAL" && row.wouldChange).length,
              softwareBkJobsToSet: previewJobs.filter((row) => row.targetDepartmentCode === "SOFTWARE_BK" && row.wouldChange).length,
              bkJobsToSet: previewJobs.filter((row) => row.targetDepartmentCode === "BK" && row.wouldChange).length,
            },
            clients: previewClients,
            jobs: previewJobs,
          },
          null,
          2,
        ),
      );
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const departmentRows = await tx.department.findMany({
        where: { code: { in: ["SOFTWARE_BK", "BK"] } },
        select: { id: true, code: true },
      });
      const departmentByCode = new Map(departmentRows.map((department) => [department.code, department.id]));
      const softwareDepartmentId = departmentByCode.get("SOFTWARE_BK");
      const bkDepartmentId = departmentByCode.get("BK");

      if (!softwareDepartmentId || !bkDepartmentId) {
        throw new Error("Required departments are missing. Run prisma:seed first.");
      }

      let clientCount = 0;
      for (const row of previewClients.filter((client) => client.wouldChange || client.bookkeepingWouldChange)) {
        const clientData = {};
        if (row.wouldChange) clientData.category = row.targetCategory;
        if (row.targetCategory === "MANUAL") {
          clientData.bookkeepingSoftware = null;
          clientData.bookkeepingBy = "FIRM";
        } else if (row.bookkeepingWouldChange) {
          clientData.bookkeepingBy = row.targetBookkeepingBy;
        }

        await tx.client.update({
          where: { id: row.clientId },
          data: clientData,
        });
        clientCount += 1;
      }

      let jobCount = 0;
      for (const row of previewJobs.filter((job) => job.wouldChange)) {
        const targetDepartmentId = row.targetDepartmentCode === "SOFTWARE_BK" ? softwareDepartmentId : bkDepartmentId;

        await tx.job.update({
          where: { id: row.jobId },
          data: {
            autoDetectedDepartmentId: targetDepartmentId,
            finalDepartmentId: targetDepartmentId,
            departmentManuallyOverridden: false,
          },
        });

        await tx.jobChangeLog.create({
          data: {
            jobId: row.jobId,
            changedById: null,
            changeSource: ChangeSource.SYSTEM,
            fieldName: "source_manager_backfill",
            oldValue: row.currentDepartmentCode,
            newValue: row.targetDepartmentCode,
          },
        });

        jobCount += 1;
      }

      return { clientCount, jobCount };
    });

    console.log(
      JSON.stringify(
        {
          mode: "apply",
          summary: {
            matchedClients: previewClients.length,
            updatedClients: updated.clientCount,
            matchedJobs: previewJobs.length,
            updatedJobs: updated.jobCount,
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