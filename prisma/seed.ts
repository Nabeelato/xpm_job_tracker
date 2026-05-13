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
      where: { email: ADMIN_EMAIL.toLowerCase() },
      update: {
        name: ADMIN_NAME,
        passwordHash,
        role: UserRole.ADMIN,
        departmentId: null,
        active: true,
      },
      create: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL.toLowerCase(),
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
    let managerSeeds: Array<{ name?: string; email?: string; password?: string; departmentCode?: string }>;
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
      const email = manager.email?.trim().toLowerCase();
      const password = manager.password ?? "";
      const departmentCode = manager.departmentCode?.trim().toUpperCase();
      if (!name || !email || password.length < 8 || !departmentCode) {
        console.warn("Skipping department manager seed with missing name, email, password, or departmentCode.");
        continue;
      }

      const department = await prisma.department.findUnique({ where: { code: departmentCode } });
      if (!department) {
        console.warn(`Skipping ${email}; department ${departmentCode} does not exist.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          passwordHash,
          role: UserRole.MANAGER,
          departmentId: department.id,
          active: true,
        },
        create: {
          name,
          email,
          passwordHash,
          role: UserRole.MANAGER,
          departmentId: department.id,
        },
      });

      await prisma.departmentDefaultAssignee.upsert({
        where: {
          departmentId_userId: {
            departmentId: department.id,
            userId: user.id,
          },
        },
        update: { active: true },
        create: {
          departmentId: department.id,
          userId: user.id,
        },
      });
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
