import "dotenv/config";
import { AssignmentRole, NotificationType, PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run scripts/users.js");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });
const DEFAULT_PASSWORD = process.env.USER_SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";
const REQUESTED_ADMIN_USERNAMES = ["maaz.imran", "irfan.tanwir", "taaha.sheikh"];

async function syncAdminExceptionNotifications() {
  const admins = await prisma.user.findMany({
    where: { active: true, role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!admins.length) return;

  const unclassifiedJobs = await prisma.job.findMany({
    where: { archived: false, finalDepartment: { code: "UNCLASSIFIED" } },
    select: { id: true, jobIdFromExcel: true, sourceManagerName: true },
  });
  for (const admin of admins) {
    const existingWarnings = await prisma.notification.findMany({
      where: {
        recipientId: admin.id,
        type: NotificationType.UNCLASSIFIED_JOB,
        jobId: { in: unclassifiedJobs.map((job) => job.id) },
        readAt: null,
      },
      select: { jobId: true },
    });
    const warnedJobIds = new Set(existingWarnings.map((notification) => notification.jobId));
    const missingWarnings = unclassifiedJobs
      .filter((job) => !warnedJobIds.has(job.id))
      .map((job) => ({
        recipientId: admin.id,
        type: NotificationType.UNCLASSIFIED_JOB,
        title: "Unclassified job requires review",
        body: job.sourceManagerName?.trim()
          ? `${job.jobIdFromExcel} was imported into Unclassified. XPM manager "${job.sourceManagerName}" and the job details did not match a department rule. Please review and assign the correct department.`
          : `${job.jobIdFromExcel} was imported into Unclassified. No XPM manager was assigned and the job details did not match a department rule. Please review and assign the correct department.`,
        href: `/jobs/${job.id}`,
        jobId: job.id,
      }));
    if (missingWarnings.length) {
      await prisma.notification.createMany({ data: missingWarnings, skipDuplicates: true });
    }
  }

  const openJobWhere = {
    archived: false,
    OR: [{ jobStateNumber: null }, { jobStateNumber: { notIn: [11, 12] } }],
  };
  const summaries = [
    {
      type: NotificationType.MISSING_STAFF,
      role: AssignmentRole.STAFF,
      title: "Missing staff assignments",
      roleLabel: "staff",
      href: "/reports/exceptions?type=missing_staff",
    },
    {
      type: NotificationType.MISSING_SUPERVISOR,
      role: AssignmentRole.SUPERVISOR,
      title: "Missing supervisor assignments",
      roleLabel: "supervisor",
      href: "/reports/exceptions?type=missing_supervisor",
    },
  ];

  for (const summary of summaries) {
    const count = await prisma.job.count({
      where: {
        AND: [
          openJobWhere,
          { assignments: { none: { active: true, assignmentRole: summary.role, user: { active: true } } } },
        ],
      },
    });
    for (const admin of admins) {
      const existing = await prisma.notification.findFirst({
        where: {
          recipientId: admin.id,
          type: summary.type,
          jobId: null,
          readAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!count) {
        if (existing) {
          await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
        }
        continue;
      }

      const body = `${count} active job${count === 1 ? "" : "s"} do${count === 1 ? "es" : ""} not have an active ${summary.roleLabel} assignment. Review the exception report now.`;
      if (existing) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: { title: summary.title, body, href: summary.href, createdAt: new Date() },
        });
      } else {
        await prisma.notification.create({
          data: {
            recipientId: admin.id,
            type: summary.type,
            title: summary.title,
            body,
            href: summary.href,
          },
        });
      }
    }
  }
}

async function main() {
  console.log("Starting requested hierarchy seed...");

  const departments = await prisma.department.findMany({ select: { id: true, code: true } });
  const departmentIdByCode = new Map(departments.map((department) => [department.code, department.id]));

  async function upsertUser({ name, username, role, departmentCode, supervisorId = null }) {
    const departmentId = departmentIdByCode.get(departmentCode);
    if (!departmentId) throw new Error(`Department ${departmentCode} does not exist.`);

    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    const hierarchyData = {
      name,
      role,
      departmentId,
      supervisorId,
      active: true,
    };
    const user = existing
      ? await prisma.user.update({ where: { username }, data: hierarchyData })
      : await prisma.user.create({
          data: {
            ...hierarchyData,
            username,
            passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 12),
          },
        });

    console.log(existing ? `♻ Updated user: ${username}` : `✅ Created user: ${username}`);
    return user;
  }

  const maaz = await upsertUser({
    name: "Maaz Imran",
    username: "maaz.imran",
    role: UserRole.ADMIN,
    departmentCode: "AFS",
  });
  const irfan = await upsertUser({
    name: "Irfan Tanwir",
    username: "irfan.tanwir",
    role: UserRole.ADMIN,
    departmentCode: "SOFTWARE_BK",
  });
  const taaha = await upsertUser({
    name: "Taaha Sheikh",
    username: "taaha.sheikh",
    role: UserRole.ADMIN,
    departmentCode: "BK",
  });
  void maaz;

  const faizan = await upsertUser({
    name: "Faizan Ali",
    username: "faizan.ali",
    role: UserRole.MANAGER,
    departmentCode: "VAT",
  });
  await upsertUser({
    name: "Abdul Toheed",
    username: "abdul.toheed",
    role: UserRole.MANAGER,
    departmentCode: "QC",
  });

  const hashir = await upsertUser({
    name: "Hashir",
    username: "hashir",
    role: UserRole.SUPERVISOR,
    departmentCode: "VAT",
    supervisorId: faizan.id,
  });
  const saira = await upsertUser({
    name: "Saira Kanwal",
    username: "saira.kanwal",
    role: UserRole.SUPERVISOR,
    departmentCode: "VAT",
    supervisorId: faizan.id,
  });
  const ahmadMaqbool = await upsertUser({
    name: "Ahmad Maqbool",
    username: "ahmad.maqbool",
    role: UserRole.SUPERVISOR,
    departmentCode: "BK",
    supervisorId: taaha.id,
  });
  await upsertUser({
    name: "Irtaza Jamshid",
    username: "irtaza.jamshid",
    role: UserRole.SUPERVISOR,
    departmentCode: "BK",
    supervisorId: taaha.id,
  });

  const softwareSupervisors = [
    ["Amer Khawaja", "amer.khawaja"],
    ["Aroosh Shahram", "aroosh.shahram"],
    ["Arslan Asif", "arslan.asif"],
    ["Nabeel Hussain", "nabeel.hussain"],
    ["Ayaan Ali", "ayaan.ali"],
    ["Usama Arshad", "usama.arshad"],
    ["Zeeshan Qadir", "zeeshan.qadir"],
    ["Ahmad Raza", "ahmad.raza1"],
    ["Ayesha Ibrahim", "ayesha.ibrahim"],
    ["Muhammad Abdullah", "muhammad.abdullah"],
    ["Saim Amjad", "saim.amjad"],
    ["Jawad Khan", "jawad.khan"],
    ["Kinza Saboor", "kinza.saboor"],
    ["Zainab Tariq", "zainab.tariq"],
    ["Zainab Usman", "zainab.usman"],
    ["Hadi Ahmad", "hadi.ahmad"],
  ];
  for (const [name, username] of softwareSupervisors) {
    await upsertUser({
      name,
      username,
      role: UserRole.SUPERVISOR,
      departmentCode: "SOFTWARE_BK",
      supervisorId: irfan.id,
    });
  }

  async function createStaff(name, username, departmentCode, supervisorId) {
    return upsertUser({ name, username, role: UserRole.STAFF, departmentCode, supervisorId });
  }

  await createStaff("Abdul Rahman", "abdul.rahman", "BK", ahmadMaqbool.id);
  await createStaff("Hamza Sarfraz", "hamza.sarfraz", "BK", ahmadMaqbool.id);
  await createStaff("Muhammad Ammar", "muhammad.ammar", "BK", ahmadMaqbool.id);
  await createStaff("Saif Ullah", "saif.ullah", "BK", ahmadMaqbool.id);

  await createStaff("Ahmad Raza", "ahmad.raza2", "VAT", saira.id);
  await createStaff("Murtaza Jamshid", "murtaza.jamshid", "VAT", saira.id);
  await createStaff("Shomaiza Imtiaz", "shomaiza.imtiaz", "VAT", saira.id);
  await createStaff("Usman Akram", "usman.akram", "VAT", saira.id);

  await createStaff("Abdul Aziz", "abdul.aziz", "VAT", hashir.id);
  await createStaff("Alishba Waseem", "alishba.waseem", "VAT", hashir.id);
  await createStaff("Muhammad Saad", "muhammad.saad", "VAT", hashir.id);
  await createStaff("Muhammad Talha", "muhammad.talha", "VAT", hashir.id);
  await createStaff("Rohan Abbas", "rohan.abbas", "VAT", hashir.id);
  await createStaff("Zulqarnain Qasim", "zulqarnain.qasim", "VAT", hashir.id);

  const softwareDepartmentId = departmentIdByCode.get("SOFTWARE_BK");
  await prisma.user.updateMany({
    where: { departmentId: softwareDepartmentId, role: UserRole.STAFF },
    data: { role: UserRole.SUPERVISOR, supervisorId: irfan.id },
  });

  const invalidRoleAssignments = await prisma.jobAssignment.updateMany({
    where: {
      active: true,
      OR: [
        { assignmentRole: AssignmentRole.MANAGER, user: { role: { notIn: [UserRole.ADMIN, UserRole.MANAGER] } } },
        { assignmentRole: AssignmentRole.SUPERVISOR, user: { role: { not: UserRole.SUPERVISOR } } },
        { assignmentRole: AssignmentRole.STAFF, user: { role: { not: UserRole.STAFF } } },
      ],
    },
    data: { active: false },
  });

  const activeStaffAssignments = await prisma.jobAssignment.findMany({
    where: { active: true, assignmentRole: AssignmentRole.STAFF },
    select: {
      id: true,
      user: { select: { supervisorId: true } },
      job: {
        select: {
          assignments: {
            where: { active: true, assignmentRole: AssignmentRole.SUPERVISOR },
            select: { userId: true },
          },
        },
      },
    },
  });
  const invalidTeamAssignmentIds = activeStaffAssignments
    .filter((assignment) => !assignment.user.supervisorId || !assignment.job.assignments.some(
      (supervisorAssignment) => supervisorAssignment.userId === assignment.user.supervisorId,
    ))
    .map((assignment) => assignment.id);
  if (invalidTeamAssignmentIds.length) {
    await prisma.jobAssignment.updateMany({
      where: { id: { in: invalidTeamAssignmentIds } },
      data: { active: false },
    });
  }

  const bootstrapUsername = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (bootstrapUsername && !REQUESTED_ADMIN_USERNAMES.includes(bootstrapUsername)) {
    await prisma.user.updateMany({
      where: { username: bootstrapUsername, role: UserRole.ADMIN },
      data: { active: false },
    });
  }

  await syncAdminExceptionNotifications();

  console.log(`Hierarchy seed completed. Removed ${invalidRoleAssignments.count} role-mismatched and ${invalidTeamAssignmentIds.length} cross-team assignments.`);
}

main()
  .catch((error) => {
    console.error("User seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
