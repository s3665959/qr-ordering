import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // A non-secret placeholder keeps format/validate usable before MySQL is
    // available. Migration and seed commands must still receive a real URL.
    url: process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@127.0.0.1:3306/shabu_buffet",
  },
});
