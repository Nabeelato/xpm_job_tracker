const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
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
    throw new Error("DATABASE_URL is missing. Run this script from the project root with a valid .env file.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

  try {
    const numericStateCount = await prisma.$executeRawUnsafe(`
      UPDATE jobs
      SET job_state_number = CASE
        WHEN xpm_state ~ '^[0-9]{1,2}' THEN CAST(substring(xpm_state from '^[0-9]{1,2}') AS integer)
        ELSE NULL
      END
      WHERE job_state_number IS NULL AND xpm_state IS NOT NULL;
    `);

    const stateEnteredCount = await prisma.$executeRawUnsafe(`
      UPDATE jobs
      SET state_entered_at = COALESCE(last_seen_at, created_at)
      WHERE state_entered_at IS NULL AND job_state_number IS NOT NULL;
    `);

    const summary = await prisma.job.groupBy({
      by: ["jobStateNumber"],
      _count: { _all: true },
      orderBy: { jobStateNumber: "asc" },
    });

    const nullCounts = {
      stateNumberNull: await prisma.job.count({ where: { jobStateNumber: null } }),
      stateEnteredAtNull: await prisma.job.count({ where: { stateEnteredAt: null } }),
    };

    console.log(
      JSON.stringify(
        {
          updated: {
            jobStateNumberRows: numericStateCount,
            stateEnteredAtRows: stateEnteredCount,
          },
          nullCounts,
          summary,
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