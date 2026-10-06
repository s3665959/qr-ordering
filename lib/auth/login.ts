import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/errors/http-error";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  STAFF_SESSION_COOKIE,
  createOpaqueToken,
  hashStaffSessionToken,
} from "@/lib/auth/tokens";
import { getRuntimeEnv } from "@/lib/config/env";
import { createHmac } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function throttleKey(username: string, clientIp?: string) {
  return createHmac("sha256", getRuntimeEnv().AUTH_SESSION_SECRET)
    .update(`login:${username.trim().toLowerCase()}:${clientIp ?? "account"}`)
    .digest("hex");
}

async function databaseNow(tx: Prisma.TransactionClient) {
  const result = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`;
  return result[0]?.now ?? new Date();
}

async function checkLoginThrottle(tx: Prisma.TransactionClient, keyHash: string, now: Date) {
  const row = await tx.loginThrottle.findUnique({ where: { keyHash } });
  if (row?.lockedUntil && row.lockedUntil > now) {
    throw new HttpError(429, "LOGIN_RATE_LIMITED", "ลองเข้าสู่ระบบอีกครั้งภายหลัง");
  }
}

async function recordFailedLogin(tx: Prisma.TransactionClient, keyHash: string, now: Date, staffUserId?: string) {
  const row = await tx.loginThrottle.findUnique({ where: { keyHash } });
  const inWindow = row && now.getTime() - row.windowStartedAt.getTime() < LOGIN_WINDOW_MS;
  const failures = inWindow ? row.failureCount + 1 : 1;
  await tx.loginThrottle.upsert({
    where: { keyHash },
    create: { keyHash, staffUserId, windowStartedAt: now, failureCount: 1, lockedUntil: failures >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_LOCK_MS) : null },
    update: { staffUserId, windowStartedAt: inWindow ? row.windowStartedAt : now, failureCount: failures, lockedUntil: failures >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_LOCK_MS) : null },
  });
}

async function clearLoginThrottle(tx: Prisma.TransactionClient, keyHash: string) {
  await tx.loginThrottle.deleteMany({ where: { keyHash } });
}

export async function loginStaff(username: string, password: string, clientIp = "unknown") {
  getRuntimeEnv();
  const keyHashes = [throttleKey(username), throttleKey(username, clientIp)];
  const result = await prisma.$transaction(async (tx) => {
    const now = await databaseNow(tx);
    for (const keyHash of keyHashes) await checkLoginThrottle(tx, keyHash, now);
    const staff = await tx.staffUser.findFirst({ where: { username, status: "ACTIVE" } });
    if (!staff || !(await verifyPassword(password, staff.passwordHash))) {
      return { invalid: true as const, now, staffUserId: staff?.id };
    }
    const rawToken = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    await tx.staffAuthSession.create({ data: { staffUserId: staff.id, sessionTokenHash: hashStaffSessionToken(rawToken), expiresAt } });
    await tx.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: now } });
    for (const keyHash of keyHashes) await clearLoginThrottle(tx, keyHash);
    return { invalid: false as const, staff, rawToken, expiresAt };
  });
  if (result.invalid) {
    await prisma.$transaction(async (tx) => {
      for (const keyHash of keyHashes) await recordFailedLogin(tx, keyHash, result.now, result.staffUserId);
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  const { staff, rawToken, expiresAt } = result;

  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { id: staff.id, displayName: staff.displayName, expiresAt };
}

export async function logoutStaff() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (rawToken) {
    await prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      await tx.staffAuthSession.updateMany({ where: { sessionTokenHash: hashStaffSessionToken(rawToken), revokedAt: null }, data: { revokedAt: now } });
    });
  }
  cookieStore.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { hashPassword };
