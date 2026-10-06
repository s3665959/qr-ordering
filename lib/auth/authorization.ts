import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/errors/http-error";
import { STAFF_SESSION_COOKIE, hashStaffSessionToken } from "@/lib/auth/tokens";
import { getRuntimeEnv } from "@/lib/config/env";

export type AuthenticatedStaff = {
  id: string;
  storeId: string;
  username: string;
  displayName: string;
  permissions: Set<string>;
};

export async function getAuthenticatedStaff(): Promise<AuthenticatedStaff | null> {
  getRuntimeEnv();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await prisma.staffAuthSession.findFirst({
    where: {
      sessionTokenHash: hashStaffSessionToken(rawToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      staffUser: { status: "ACTIVE" },
    },
    include: {
      staffUser: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      },
    },
  });

  if (!session) return null;

  const permissions = new Set(
    session.staffUser.roles.flatMap((userRole) =>
      userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
    ),
  );

  return {
    id: session.staffUser.id,
    storeId: session.staffUser.storeId,
    username: session.staffUser.username,
    displayName: session.staffUser.displayName,
    permissions,
  };
}

export async function requireStaff(permission?: string): Promise<AuthenticatedStaff> {
  const staff = await getAuthenticatedStaff();
  if (!staff) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  if (permission && !staff.permissions.has(permission)) {
    throw new HttpError(403, "FORBIDDEN", "ไม่มีสิทธิ์ดำเนินการนี้");
  }
  return staff;
}
