import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

// Keep module evaluation build-safe. Database access still requires a real
// DATABASE_URL at runtime; the placeholder only prevents Next build from
// opening a connection or throwing while collecting route metadata.
const databaseUrl =
  process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@127.0.0.1:3306/shabu_buffet";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
