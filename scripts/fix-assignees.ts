/**
 * Fixes the department default assignees to match the correct assignment rules:
 *
 *   Import Manager → Department → Assigned To
 *   Haseeb Tariq   → BK         → Saira + Ahmed Maqbool
 *   Taaha Imran    → SOFTWARE_BK→ Aroosh Shahram
 *   Maaz Imran     → AFS        → Maaz Imran  (already correct)
 *   Faizan Ali     → VAT        → Faizan Ali   (already correct)
 *
 * Creates missing accounts and corrects the DepartmentDefaultAssignee table.
 * Run with:  npx tsx scripts/fix-assignees.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

// New staff accounts to create as SUPERVISOR
const NEW_SUPERVISORS = [
  { name: "Saira",          email: "saira@example.com",           password: "Saira@123",    departmentCode: "BK" },
  { name: "Ahmed Maqbool",  email: "ahmed.maqbool@example.com",  password: "Ahmed@123",    departmentCode: "BK" },
  { name: "Aroosh Shahram", email: "aroosh.shahram@example.com", password: "Aroosh@123",   departmentCode: "SOFTWARE_BK" },
];

// Remove these users from DepartmentDefaultAssignee (they are import-file managers, not workers)
const REMOVE_FROM_AUTO_ASSIGN = [
  { email: "haseeb.tariq@example.com", departmentCode: "BK" },
  { email: "taaha.imran@example.com",  departmentCode: "SOFTWARE_BK" },
];

async function main() {
  console.log("Step 1: Create new supervisor accounts\n");

  for (const s of NEW_SUPERVISORS) {
    const department = await prisma.department.findUnique({ where: { code: s.departmentCode } });
    if (!department) {
      console.error(`  ✗ Department "${s.departmentCode}" not found.`);
      continue;
    }

    const passwordHash = await bcrypt.hash(s.password, 12);
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, passwordHash, role: UserRole.SUPERVISOR, departmentId: department.id, active: true },
      create: { name: s.name, email: s.email, passwordHash, role: UserRole.SUPERVISOR, departmentId: department.id },
    });

    await prisma.departmentDefaultAssignee.upsert({
      where: { departmentId_userId: { departmentId: department.id, userId: user.id } },
      update: { active: true },
      create: { departmentId: department.id, userId: user.id },
    });

    console.log(`  ✓ ${s.name}`);
    console.log(`      Email   : ${s.email}`);
    console.log(`      Password: ${s.password}`);
    console.log(`      Role    : SUPERVISOR`);
    console.log(`      Dept    : ${department.name} — set as default assignee`);
    console.log();
  }

  console.log("Step 2: Remove Haseeb Tariq and Taaha Imran from auto-assign\n");
  console.log("  (They appear as managers in the import file but are not the ones doing the work.)\n");

  for (const entry of REMOVE_FROM_AUTO_ASSIGN) {
    const user = await prisma.user.findUnique({ where: { email: entry.email } });
    if (!user) {
      console.log(`  — ${entry.email} not found, skipping.`);
      continue;
    }
    const department = await prisma.department.findUnique({ where: { code: entry.departmentCode } });
    if (!department) continue;

    const removed = await prisma.departmentDefaultAssignee.updateMany({
      where: { userId: user.id, departmentId: department.id, active: true },
      data: { active: false },
    });

    if (removed.count > 0) {
      console.log(`  ✓ Removed ${user.name} from auto-assign for ${entry.departmentCode}`);
    } else {
      console.log(`  — ${user.name} was not an active auto-assignee for ${entry.departmentCode}`);
    }
  }

  console.log("\nFinal auto-assign state:");
  const all = await prisma.departmentDefaultAssignee.findMany({
    where: { active: true },
    include: { user: true, department: true },
    orderBy: [{ department: { code: "asc" } }, { user: { name: "asc" } }],
  });
  for (const a of all) {
    console.log(`  ${a.department.code.padEnd(12)} → ${a.user.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
