import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

async function main() {
  const departments = [
    { code: "VAT", name: "VAT" },
    { code: "SOFTWARE_BK", name: "Software Bookkeeping" },
    { code: "BK", name: "Bookkeeping" },
    { code: "AFS", name: "Annual Financial Statements" },
    { code: "QC", name: "QC Department" },
    { code: "UNCLASSIFIED", name: "Unclassified" },
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name, active: true },
      create: department,
    });
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;

  if (ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_NAME) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where: { username: ADMIN_EMAIL.toLowerCase() },
      update: {
        name: ADMIN_NAME,
        passwordHash,
        role: UserRole.ADMIN,
        departmentId: null,
        active: true,
      },
      create: {
        name: ADMIN_NAME,
        username: ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
  } else {
    console.warn(
      "ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME were not all provided. Default admin was not created.",
    );
  }

  const managerSeedJson = process.env.DEPARTMENT_MANAGER_USERS_JSON;
  if (managerSeedJson) {
    let managerSeeds: Array<{ name?: string; username?: string; email?: string; password?: string; departmentCode?: string }>;
    try {
      managerSeeds = JSON.parse(managerSeedJson);
    } catch {
      throw new Error("DEPARTMENT_MANAGER_USERS_JSON must be a valid JSON array.");
    }

    if (!Array.isArray(managerSeeds)) {
      throw new Error("DEPARTMENT_MANAGER_USERS_JSON must be a valid JSON array.");
    }

    for (const manager of managerSeeds) {
      const name = manager.name?.trim();
      const username = (manager.username ?? manager.email)?.trim().toLowerCase();
      const password = manager.password ?? "";
      const departmentCode = manager.departmentCode?.trim().toUpperCase();
      if (!name || !username || password.length < 8 || !departmentCode) {
        console.warn("Skipping department manager seed with missing name, username/email, password, or departmentCode.");
        continue;
      }

      const department = await prisma.department.findUnique({ where: { code: departmentCode } });
      if (!department) {
        console.warn(`Skipping ${username}; department ${departmentCode} does not exist.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.upsert({
        where: { username },
        update: {
          name,
          passwordHash,
          role: UserRole.MANAGER,
          departmentId: department.id,
          active: true,
        },
        create: {
          name,
          username,
          passwordHash,
          role: UserRole.MANAGER,
          departmentId: department.id,
        },
      });

      void user;
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
