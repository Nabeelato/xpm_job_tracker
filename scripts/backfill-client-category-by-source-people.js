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

function desiredCategory(irfanPartnerJobs, taahaPartnerJobs) {
  if (irfanPartnerJobs > 0) return "SOFTWARE";
  if (taahaPartnerJobs > 0) return "MANUAL";
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
      WITH matched_clients AS (
        SELECT
          c.id AS client_id,
          c.display_name,
          c.category,
          COUNT(*) FILTER (WHERE j.source_partner_name ILIKE '%irfan tanvir%' OR j.source_partner_name ILIKE '%irfan tanwir%')::int AS irfan_partner_jobs,
          COUNT(*) FILTER (WHERE j.source_partner_name ILIKE '%taaha imran%' OR j.source_partner_name ILIKE '%taaha sheikh%')::int AS taaha_partner_jobs,
          COUNT(*)::int AS matched_jobs
        FROM clients c
        JOIN jobs j ON j.client_id = c.id
        WHERE j.source_partner_name ILIKE '%irfan tanvir%'
           OR j.source_partner_name ILIKE '%irfan tanwir%'
           OR j.source_partner_name ILIKE '%taaha imran%'
           OR j.source_partner_name ILIKE '%taaha sheikh%'
        GROUP BY c.id, c.display_name, c.category
      )
      SELECT *
      FROM matched_clients
      ORDER BY matched_jobs DESC, display_name ASC;
    `);

    const preview = rows.map((row) => {
      const targetCategory = desiredCategory(Number(row.irfan_partner_jobs), Number(row.taaha_partner_jobs));
      return {
        clientId: row.client_id,
        clientName: row.display_name,
        currentCategory: row.category,
        targetCategory,
        irfanPartnerJobs: Number(row.irfan_partner_jobs),
        taahaPartnerJobs: Number(row.taaha_partner_jobs),
        matchedJobs: Number(row.matched_jobs),
        wouldChange: targetCategory && targetCategory !== row.category,
      };
    });

    const toUpdate = preview.filter((row) => row.wouldChange);

    if (!applyChanges) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            summary: {
              matchedClients: preview.length,
              clientsThatWouldChange: toUpdate.length,
              manualClientsToSet: toUpdate.filter((row) => row.targetCategory === "MANUAL").length,
              softwareClientsToSet: toUpdate.filter((row) => row.targetCategory === "SOFTWARE").length,
            },
            clients: preview,
          },
          null,
          2,
        ),
      );
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const row of toUpdate) {
        await tx.client.update({
          where: { id: row.clientId },
          data: { category: row.targetCategory },
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
            matchedClients: preview.length,
            updatedClients: updated,
            manualClientsSet: toUpdate.filter((row) => row.targetCategory === "MANUAL").length,
            softwareClientsSet: toUpdate.filter((row) => row.targetCategory === "SOFTWARE").length,
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
