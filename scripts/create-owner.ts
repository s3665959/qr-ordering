import "dotenv/config";
import { createInterface } from "node:readline";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
  throw new Error("DATABASE_URL must be configured with a mysql:// URL");
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

function ask(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => readline.question(question, (answer) => { readline.close(); resolve(answer.trim()); }));
}

function askSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("OWNER password setup requires an interactive terminal");
  }
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      const input = chunk.toString("utf8");
      if (input === "\u0003") {
        cleanup();
        reject(new Error("cancelled"));
      } else if (input === "\r" || input === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
      } else if (input === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += input;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const username = await ask("OWNER username: ");
  const password = await askSecret("OWNER password (hidden): ");
  const confirmation = await askSecret("Confirm password (hidden): ");
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) throw new Error("username must be 3-100 chars: letters, numbers, dot, underscore or hyphen");
  if (password.length < 12) throw new Error("OWNER password must be at least 12 characters");
  if (password !== confirmation) throw new Error("password confirmation does not match");

  const store = await prisma.store.findUnique({ where: { code: "MAIN" } });
  const role = await prisma.role.findUnique({ where: { code: "OWNER" } });
  if (!store || !role) throw new Error("Run npm run db:seed before creating the first OWNER account");
  const existing = await prisma.staffUser.findFirst({ where: { storeId: store.id, username } });
  if (existing) throw new Error("That username already exists in the MAIN store");

  const staff = await prisma.staffUser.create({
    data: {
      storeId: store.id,
      username,
      passwordHash: await hashPassword(password),
      displayName: username,
      roles: { create: { roleId: role.id } },
    },
    select: { username: true },
  });
  console.log(`Created OWNER account: ${staff.username}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "owner setup failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
