/**
 * One-time script to create the four department supervisor accounts and set them
 * as department default assignees so they get auto-assigned on every import.
 *
 * Run with:  npx tsx scripts/seed-supervisors.ts
 *
 * Manager → Department mapping used during import (from import file [Job] Manager column):
 *   Haseeb Tariq  →  Bookkeeping (BK)
 *   Taaha Imran   →  Software Bookkeeping (SOFTWARE_BK)
 *   Maaz Imran    →  AFS
 *   Faizan Ali    →  VAT
 */

import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

const SUPERVISORS = [
  {
    name: "Haseeb Tariq",
    email: "haseeb.tariq@example.com",
    password: "Haseeb@123",
    departmentCode: "BK",
  },
  {
    name: "Taaha Imran",
    email: "taaha.imran@example.com",
    password: "Taaha@123",
    departmentCode: "SOFTWARE_BK",
  },
  {
    name: "Maaz Imran",
    email: "maaz.imran@example.com",
    password: "Maaz@123",
    departmentCode: "AFS",
  },
  {
    name: "Faizan Ali",
    email: "faizan.ali@example.com",
    password: "Faizan@123",
    departmentCode: "VAT",
  },
];

async function main() {
  console.log("Creating supervisor accounts…\n");

  for (const s of SUPERVISORS) {
    const department = await prisma.department.findUnique({ where: { code: s.departmentCode } });
    if (!department) {
      console.error(`  ✗ Department "${s.departmentCode}" not found — run prisma:seed first.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(s.password, 12);

    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        passwordHash,
        role: UserRole.SUPERVISOR,
        departmentId: department.id,
        active: true,
      },
      create: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: UserRole.SUPERVISOR,
        departmentId: department.id,
      },
    });

    // Make them a department default assignee so they are auto-assigned on import
    await prisma.departmentDefaultAssignee.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId: user.id } },
      update: { active: true },
      create: { departmentId: department.id, userId: user.id },
    });

    console.log(`  ✓ ${s.name}`);
    console.log(`      Email   : ${s.email}`);
    console.log(`      Password: ${s.password}`);
    console.log(`      Role    : SUPERVISOR`);
    console.log(`      Dept    : ${department.name} (${s.departmentCode})`);
    console.log();
  }

  console.log("Done. You can change each user's role to MANAGER later via the Users page.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
