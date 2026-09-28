// First deployment helper: loads the demo data during the build, but ONLY when
// SEED_DEMO_DATA=true AND the database has no user yet. It can never erase existing data.
import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function run() {
  if (process.env.SEED_DEMO_DATA !== "true") return;
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const users = await db.user.count();
  await db.$disconnect();
  if (users > 0) {
    console.log(`Demo data: skipped, the database already has ${users} user(s).`);
    return;
  }
  console.log("Demo data: empty database, loading the demo data…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, DATABASE_URL: connectionString } });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
