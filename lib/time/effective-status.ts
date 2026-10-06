import type { TableSessionLifecycleStatus } from "@/generated/prisma/client";

export type EffectiveTableStatus =
  | "AVAILABLE"
  | "PAID_PENDING_START"
  | "ACTIVE"
  | "ENDING_SOON"
  | "TIME_EXPIRED"
  | "CLOSED"
  | "CANCELLED";

export function getEffectiveTableStatus(
  lifecycleStatus: TableSessionLifecycleStatus | null,
  startedAt: Date | null,
  endsAt: Date | null,
  now: Date,
  alertBeforeMinutes = 15,
): EffectiveTableStatus {
  if (!lifecycleStatus) return "AVAILABLE";
  if (lifecycleStatus === "PAID_PENDING_START") return "PAID_PENDING_START";
  if (lifecycleStatus === "CLOSED") return "CLOSED";
  if (lifecycleStatus === "CANCELLED") return "CANCELLED";
  if (!startedAt || !endsAt) return "PAID_PENDING_START";
  if (now.getTime() >= endsAt.getTime()) return "TIME_EXPIRED";
  if (now.getTime() >= endsAt.getTime() - alertBeforeMinutes * 60_000) return "ENDING_SOON";
  return "ACTIVE";
}

export function assertOrderingWindow(
  lifecycleStatus: TableSessionLifecycleStatus,
  startedAt: Date | null,
  endsAt: Date | null,
  now: Date,
) {
  if (lifecycleStatus !== "ACTIVE" || !startedAt) {
    throw new Error("TABLE_SESSION_NOT_STARTED");
  }
  if (!endsAt || now.getTime() >= endsAt.getTime()) {
    throw new Error("ORDERING_WINDOW_EXPIRED");
  }
}
