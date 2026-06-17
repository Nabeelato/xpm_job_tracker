import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run scripts/users.js");
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

// Default password for all users unless overridden in the shell.
const DEFAULT_PASSWORD = process.env.USER_SEED_DEFAULT_PASSWORD ?? "ChangeMe123!";

async function upsertUser({ name, username, role, supervisorId }) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      name,
      passwordHash,
      role,
      supervisorId: supervisorId ?? null,
      active: true,
    },
    create: {
      name,
      username,
      passwordHash,
      role,
      supervisorId: supervisorId ?? null,
    },
  });

  console.log(existing ? `♻ Updated user: ${username}` : `✅ Created user: ${username}`);
  return user;
}

async function main() {
  console.log("Starting user seed...");

  const manager = await upsertUser({
    name: "Maaz Imran",
    username: "maaz.imran",
    role: UserRole.MANAGER,
  });

  const amer = await upsertUser({
    name: "Amer Khawaja",
    username: "amer.khawaja",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const aroosh = await upsertUser({
    name: "Aroosh Shahram",
    username: "aroosh.shahram",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const ahmadMaqbool = await upsertUser({
    name: "Ahmad Maqbool",
    username: "ahmad.maqbool",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const saira = await upsertUser({
    name: "Saira Kanwal",
    username: "saira.kanwal",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const arslan = await upsertUser({
    name: "Arslan Asif",
    username: "arslan.asif",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const hashir = await upsertUser({
    name: "Hashir",
    username: "hashir",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const faizan = await upsertUser({
    name: "Faizan Ali",
    username: "faizan.ali",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const abdulToheed = await upsertUser({
    name: "Abdul Toheed",
    username: "abdul.toheed",
    role: UserRole.SUPERVISOR,
    supervisorId: manager.id,
  });

  const createEmployee = (name, username, supervisorId) =>
    upsertUser({
      name,
      username,
      role: UserRole.STAFF,
      supervisorId,
    });

  await createEmployee("Nabeel Hussain", "nabeel.hussain", amer.id);
  await createEmployee("Ayaan Ali", "ayaan.ali", amer.id);
  await createEmployee("Usama Arshad", "usama.arshad", amer.id);
  await createEmployee("Zeeshan Qadir", "zeeshan.qadir", amer.id);

  await createEmployee("Ahmad Raza", "ahmad.raza1", aroosh.id);
  await createEmployee("Ayesha Ibrahim", "ayesha.ibrahim", aroosh.id);
  await createEmployee("Muhammad Abdullah", "muhammad.abdullah", aroosh.id);
  await createEmployee("Saim Amjad", "saim.amjad", aroosh.id);

  await createEmployee("Abdul Rahman", "abdul.rahman", ahmadMaqbool.id);
  await createEmployee("Hamza Sarfraz", "hamza.sarfraz", ahmadMaqbool.id);
  await createEmployee("Irtaza Jamshid", "irtaza.jamshid", ahmadMaqbool.id);
  await createEmployee("Muhammad Ammar", "muhammad.ammar", ahmadMaqbool.id);
  await createEmployee("Saif Ullah", "saif.ullah", ahmadMaqbool.id);

  await createEmployee("Ahmad Raza", "ahmad.raza2", saira.id);
  await createEmployee("Murtaza Jamshid", "murtaza.jamshid", saira.id);
  await createEmployee("Shomaiza Imtiaz", "shomaiza.imtiaz", saira.id);
  await createEmployee("Usman Akram", "usman.akram", saira.id);

  await createEmployee("Jawad Khan", "jawad.khan", arslan.id);
  await createEmployee("Kinza Saboor", "kinza.saboor", arslan.id);
  await createEmployee("Zainab Tariq", "zainab.tariq", arslan.id);
  await createEmployee("Zainab Usman", "zainab.usman", arslan.id);
  await createEmployee("Hadi Ahmad", "hadi.ahmad", arslan.id);

  await createEmployee("Abdul Aziz", "abdul.aziz", hashir.id);
  await createEmployee("Alishba Waseem", "alishba.waseem", hashir.id);
  await createEmployee("Muhammad Saad", "muhammad.saad", hashir.id);
  await createEmployee("Muhammad Talha", "muhammad.talha", hashir.id);
  await createEmployee("Rohan Abbas", "rohan.abbas", hashir.id);

  await createEmployee("Zulqarnain Qasim", "zulqarnain.qasim", faizan.id);

  await createEmployee("Amina Sabtain", "amina.sabtain", abdulToheed.id);
  await createEmployee("Haris Idrees", "haris.idrees", abdulToheed.id);

  console.log("User seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("User seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
