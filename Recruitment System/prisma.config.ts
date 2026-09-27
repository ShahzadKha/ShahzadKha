import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection; hosted databases like Neon give a separate
    // "pooled" URL for the app (DATABASE_URL) and a direct one (DIRECT_URL).
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
