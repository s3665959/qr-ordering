import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getRuntimeEnv } from "@/lib/config/env";

export const STAFF_SESSION_COOKIE = "shabu_staff_session";

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashStaffSessionToken(token: string): string {
  return createHmac("sha256", getRuntimeEnv().AUTH_SESSION_SECRET).update(token).digest("hex");
}

export function hashQrToken(token: string): string {
  return createHmac("sha256", getRuntimeEnv().QR_TOKEN_PEPPER).update(token).digest("hex");
}

export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
