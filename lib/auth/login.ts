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

export async function loginStaff(username: string, password: string) {
  getRuntimeEnv();
  const staff = await prisma.staffUser.findFirst({
    where: { username, status: "ACTIVE" },
  });

  if (!staff || !(await verifyPassword(password, staff.passwordHash))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.staffAuthSession.create({
      data: {
        staffUserId: staff.id,
        sessionTokenHash: hashStaffSessionToken(rawToken),
        expiresAt,
      },
    }),
    prisma.staffUser.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

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
    await prisma.staffAuthSession.updateMany({
      where: { sessionTokenHash: hashStaffSessionToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
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
