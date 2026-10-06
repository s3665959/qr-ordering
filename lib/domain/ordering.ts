import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashQrToken } from "@/lib/auth/tokens";
import { HttpError } from "@/lib/errors/http-error";
import { assertOrderingWindow, getEffectiveTableStatus } from "@/lib/time/effective-status";
import { withImageUrl } from "@/lib/storage/images";
import { getRuntimeEnv } from "@/lib/config/env";

function requestFingerprint(items: Array<{ menuItemId: string; quantity: number }>): string {
  return createHash("sha256")
    .update(JSON.stringify([...items].sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))))
    .digest("hex");
}

async function databaseNow(): Promise<Date> {
  const result = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`;
  return result[0]?.now ?? new Date();
}

export async function getCustomerSession(rawToken: string) {
  getRuntimeEnv();
  const tokenHash = hashQrToken(rawToken);
  const now = await databaseNow();
  const activeToken = await prisma.qrAccessToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      activePointer: { isNot: null },
    },
    include: {
      activePointer: true,
      tableSession: {
        include: {
          table: true,
          package: true,
          store: true,
          orders: { include: { items: true }, orderBy: { orderedAt: "desc" } },
        },
      },
    },
  });

  if (!activeToken || activeToken.activePointer?.tableSessionId !== activeToken.tableSessionId) {
    throw new HttpError(404, "QR_INVALID", "QR นี้ไม่สามารถใช้งานได้");
  }

  const session = activeToken.tableSession;
  const effectiveStatus = getEffectiveTableStatus(
    session.lifecycleStatus,
    session.startedAt,
    session.endsAt,
    now,
    session.store.alertBeforeMinutes,
  );

  const menu = session.allowsBeefOrderingSnapshot && ["ACTIVE", "ENDING_SOON"].includes(effectiveStatus)
    ? await prisma.menuCategory.findMany({
        where: { storeId: session.storeId, isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isActive: true, isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    : [];

  return {
    session: {
      id: session.id,
      tableName: session.table.displayName,
      packageName: session.packageNameSnapshot,
      allowsBeefOrdering: session.allowsBeefOrderingSnapshot,
      lifecycleStatus: session.lifecycleStatus,
      effectiveStatus,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
    },
    menu: menu.map((category) => ({ ...category, items: category.items.map(withImageUrl) })),
    orders: session.orders,
  };
}

export async function createCustomerOrder(
  rawToken: string,
  input: { idempotencyKey: string; items: Array<{ menuItemId: string; quantity: number }> },
) {
  getRuntimeEnv();
  const tokenHash = hashQrToken(rawToken);
  return prisma.$transaction(async (tx) => {
    const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`;
    const now = nowRows[0]?.now ?? new Date();
    const activeToken = await tx.qrAccessToken.findFirst({
      where: { tokenHash, revokedAt: null, activePointer: { isNot: null } },
      include: { activePointer: true, tableSession: { include: { store: true } } },
    });
    if (!activeToken || activeToken.activePointer?.tableSessionId !== activeToken.tableSessionId) {
      throw new HttpError(404, "QR_INVALID", "QR นี้ไม่สามารถใช้งานได้");
    }

    const session = activeToken.tableSession;
    if (!session.allowsBeefOrderingSnapshot) {
      throw new HttpError(403, "BEEF_ORDERING_NOT_ALLOWED", "แพ็กเกจนี้ไม่รองรับการสั่งเนื้อผ่าน QR");
    }
    try {
      assertOrderingWindow(session.lifecycleStatus, session.startedAt, session.endsAt, now);
    } catch (error) {
      const code = error instanceof Error ? error.message : "ORDERING_WINDOW_EXPIRED";
      throw new HttpError(409, code, code === "TABLE_SESSION_NOT_STARTED" ? "โต๊ะยังไม่เริ่มใช้บริการ" : "หมดเวลารับออเดอร์แล้ว");
    }

    const fingerprint = requestFingerprint(input.items);
    const existing = await tx.order.findUnique({
      where: { tableSessionId_idempotencyKey: { tableSessionId: session.id, idempotencyKey: input.idempotencyKey } },
      include: { items: true },
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new HttpError(409, "IDEMPOTENCY_KEY_REUSED", "idempotency key ถูกใช้กับรายการอื่นแล้ว");
      }
      return existing;
    }

    const menuItems = await tx.menuItem.findMany({
      where: {
        id: { in: input.items.map((item) => item.menuItemId) },
        isActive: true,
        isAvailable: true,
        category: { isActive: true, storeId: session.storeId },
      },
    });
    if (menuItems.length !== new Set(input.items.map((item) => item.menuItemId)).size) {
      throw new HttpError(409, "MENU_ITEM_UNAVAILABLE", "มีรายการที่ปิดขายหรือไม่พบแล้ว");
    }

    const orderNumber = `O-${now.getTime()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    const order = await tx.order.create({
      data: {
        tableSessionId: session.id,
        orderNumber,
        status: "NEW",
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        orderedAt: now,
        items: {
          create: input.items.map((item) => {
            const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId)!;
            return {
              menuItemId: menuItem.id,
              itemNameSnapshot: menuItem.name,
              servingUnitSnapshot: menuItem.servingUnit,
              quantity: item.quantity,
            };
          }),
        },
        statusEvents: { create: { toStatus: "NEW" } },
      },
      include: { items: true, statusEvents: true },
    });

    await tx.qrAccessToken.update({ where: { id: activeToken.id }, data: { lastUsedAt: now } });
    return order;
  });
}

export async function updateOrderStatus(
  orderId: string,
  staffId: string,
  storeId: string,
  toStatus: "ACCEPTED" | "PREPARING" | "DELIVERING" | "SERVED" | "CANCELLED",
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tableSession: { storeId } },
    });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "ไม่พบออเดอร์");

    const allowed: Record<string, string[]> = {
      NEW: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["PREPARING", "CANCELLED"],
      PREPARING: ["DELIVERING", "CANCELLED"],
      DELIVERING: ["SERVED", "CANCELLED"],
      SERVED: [],
      CANCELLED: [],
    };
    if (!allowed[order.status].includes(toStatus)) {
      throw new HttpError(409, "INVALID_ORDER_TRANSITION", "ไม่สามารถเปลี่ยนสถานะออเดอร์นี้ได้");
    }
    if (toStatus === "CANCELLED" && !reason?.trim()) {
      throw new HttpError(400, "CANCELLATION_REASON_REQUIRED", "การยกเลิกต้องระบุเหตุผล");
    }

    const now = new Date();
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: toStatus,
        acceptedAt: toStatus === "ACCEPTED" ? now : undefined,
        servedAt: toStatus === "SERVED" ? now : undefined,
        cancelledAt: toStatus === "CANCELLED" ? now : undefined,
        cancellationReason: toStatus === "CANCELLED" ? reason : undefined,
        statusEvents: { create: { fromStatus: order.status, toStatus, reason, changedByStaffId: staffId } },
      },
      include: { items: true, statusEvents: true },
    });
    return updated;
  });
}
