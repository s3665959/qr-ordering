import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/errors/http-error";
import { createOpaqueToken, hashQrToken } from "@/lib/auth/tokens";
import { getEffectiveTableStatus } from "@/lib/time/effective-status";

type Transaction = Prisma.TransactionClient;

async function databaseNow(tx: Transaction): Promise<Date> {
  const result = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`;
  return result[0]?.now ?? new Date();
}

type LockedTable = { id: string; tableNumber: string };

async function lockTable(tx: Transaction, storeId: string, tableId: string) {
  const rows = await tx.$queryRaw<LockedTable[]>`
    SELECT id, table_number AS tableNumber
    FROM dining_tables
    WHERE id = ${tableId} AND store_id = ${storeId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function lockNumberedTables(tx: Transaction, storeId: string) {
  return tx.$queryRaw<LockedTable[]>`
    SELECT id, table_number AS tableNumber
    FROM dining_tables
    WHERE store_id = ${storeId} AND table_number REGEXP '^[0-9]+$'
    ORDER BY CAST(table_number AS UNSIGNED), table_number
    FOR UPDATE
  `;
}

export async function openTableSession(
  input: {
    storeId: string;
    staffId: string;
    tableId: string;
    packageId: string;
    guestCount: number;
  },
) {
  return prisma.$transaction(async (tx) => {
    // All table-count mutations lock numbered tables in ascending table-number
    // order. Opening a session locks its table first, before checking state or
    // the active-session pointer, so the two operations cannot observe stale
    // state and cannot deadlock by taking table locks in different orders.
    const lockedTable = await lockTable(tx, input.storeId, input.tableId);
    const table = lockedTable
      ? await tx.diningTable.findUnique({
          where: { id: lockedTable.id },
          include: { activeSession: true },
        })
      : null;
    if (!table) throw new HttpError(404, "TABLE_NOT_FOUND", "ไม่พบโต๊ะ");
    if (!table.isActive) throw new HttpError(404, "TABLE_NOT_FOUND", "ไม่พบโต๊ะ");

    const tablePointer = table.activeSession;
    if (tablePointer) throw new HttpError(409, "TABLE_ALREADY_IN_USE", "โต๊ะนี้กำลังถูกใช้งาน");

    const buffetPackage = await tx.buffetPackage.findFirst({
      where: { id: input.packageId, storeId: input.storeId, isActive: true },
    });
    if (!buffetPackage) throw new HttpError(404, "PACKAGE_NOT_FOUND", "ไม่พบแพ็กเกจ");

    const totalAmount = Number(buffetPackage.pricePerPerson) * input.guestCount;

    const session = await tx.tableSession.create({
      data: {
        storeId: input.storeId,
        tableId: table.id,
        packageId: buffetPackage.id,
        guestCount: input.guestCount,
        packageNameSnapshot: buffetPackage.name,
        pricePerPersonSnapshot: buffetPackage.pricePerPerson,
        durationMinutesSnapshot: buffetPackage.durationMinutes,
        allowsBeefOrderingSnapshot: buffetPackage.allowsBeefOrdering,
        totalAmount,
        lifecycleStatus: "PAID_PENDING_START",
        openedById: input.staffId,
      },
    });

    await tx.activeTableSession.create({
      data: { tableId: table.id, tableSessionId: session.id },
    });

    let qrToken: string | undefined;
    if (buffetPackage.allowsBeefOrdering) {
      qrToken = createOpaqueToken();
      const token = await tx.qrAccessToken.create({
        data: {
          tableSessionId: session.id,
          tokenHash: hashQrToken(qrToken),
          issuedById: input.staffId,
        },
      });
      await tx.activeQrToken.create({
        data: { tableSessionId: session.id, qrTokenId: token.id },
      });
    }

    await tx.tableSessionEvent.create({
      data: {
        tableSessionId: session.id,
        eventType: "TABLE_OPENED",
        actorStaffId: input.staffId,
        metadata: { packageCode: buffetPackage.code, hasQr: Boolean(qrToken) },
      },
    });

    return { session, qrToken };
  });
}

export async function startTableSession(sessionId: string, staffId: string, storeId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({ where: { id: sessionId, storeId } });
    if (!session) throw new HttpError(404, "TABLE_SESSION_NOT_FOUND", "ไม่พบรอบโต๊ะ");
    if (session.lifecycleStatus !== "PAID_PENDING_START") {
      throw new HttpError(409, "TABLE_SESSION_NOT_STARTABLE", "รอบโต๊ะนี้เริ่มหรือปิดไปแล้ว");
    }
    const now = await databaseNow(tx);
    const endsAt = new Date(now.getTime() + session.durationMinutesSnapshot * 60_000);
    const updated = await tx.tableSession.update({
      where: { id: session.id },
      data: { lifecycleStatus: "ACTIVE", startedAt: now, endsAt, startedById: staffId },
    });
    await tx.tableSessionEvent.create({
      data: {
        tableSessionId: session.id,
        eventType: "TABLE_STARTED",
        actorStaffId: staffId,
        metadata: { startedAt: now.toISOString(), endsAt: endsAt.toISOString() },
      },
    });
    return updated;
  });
}

export async function extendTableSession(
  sessionId: string,
  staffId: string,
  storeId: string,
  minutes: number,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({ where: { id: sessionId, storeId } });
    if (!session) throw new HttpError(404, "TABLE_SESSION_NOT_FOUND", "ไม่พบรอบโต๊ะ");
    if (session.lifecycleStatus !== "ACTIVE" || !session.endsAt) {
      throw new HttpError(409, "TABLE_SESSION_NOT_EXTENDABLE", "รอบโต๊ะนี้ต่อเวลาไม่ได้");
    }

    const oldEndsAt = session.endsAt;
    const newEndsAt = new Date(oldEndsAt.getTime() + minutes * 60_000);
    const updated = await tx.tableSession.update({ where: { id: session.id }, data: { endsAt: newEndsAt } });
    await tx.tableSessionExtension.create({
      data: { tableSessionId: session.id, oldEndsAt, newEndsAt, minutesAdded: minutes, reason, approvedById: staffId },
    });
    await tx.tableSessionEvent.create({
      data: { tableSessionId: session.id, eventType: "TABLE_EXTENDED", actorStaffId: staffId, metadata: { minutes, reason } },
    });
    return updated;
  });
}

export async function closeTableSession(sessionId: string, staffId: string, storeId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({ where: { id: sessionId, storeId } });
    if (!session) throw new HttpError(404, "TABLE_SESSION_NOT_FOUND", "ไม่พบรอบโต๊ะ");
    if (session.lifecycleStatus === "CLOSED" || session.lifecycleStatus === "CANCELLED") {
      throw new HttpError(409, "TABLE_SESSION_ALREADY_CLOSED", "รอบโต๊ะนี้ปิดแล้ว");
    }

    const now = await databaseNow(tx);
    const activeQr = await tx.activeQrToken.findUnique({ where: { tableSessionId: session.id } });
    if (activeQr) {
      await tx.qrAccessToken.update({
        where: { id: activeQr.qrTokenId },
        data: { revokedAt: now, revokedById: staffId, revocationReason: "TABLE_SESSION_CLOSED" },
      });
      await tx.activeQrToken.delete({ where: { tableSessionId: session.id } });
    }

    await tx.activeTableSession.deleteMany({ where: { tableSessionId: session.id } });
    const updated = await tx.tableSession.update({
      where: { id: session.id },
      data: { lifecycleStatus: "CLOSED", closedAt: now, closedById: staffId },
    });
    await tx.tableSessionEvent.create({
      data: { tableSessionId: session.id, eventType: "TABLE_CLOSED", actorStaffId: staffId },
    });
    return updated;
  });
}

export async function rotateQrToken(sessionId: string, staffId: string, storeId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({ where: { id: sessionId, storeId } });
    if (!session) throw new HttpError(404, "TABLE_SESSION_NOT_FOUND", "ไม่พบรอบโต๊ะ");
    if (!session.allowsBeefOrderingSnapshot || session.lifecycleStatus === "CLOSED" || session.lifecycleStatus === "CANCELLED") {
      throw new HttpError(409, "QR_NOT_AVAILABLE", "รอบโต๊ะนี้ไม่สามารถออก QR ได้");
    }

    const now = await databaseNow(tx);
    const activeQr = await tx.activeQrToken.findUnique({ where: { tableSessionId: session.id } });
    if (activeQr) {
      await tx.qrAccessToken.update({
        where: { id: activeQr.qrTokenId },
        data: { revokedAt: now, revokedById: staffId, revocationReason: "QR_REPRINTED" },
      });
    }

    const rawToken = createOpaqueToken();
    const newToken = await tx.qrAccessToken.create({
      data: {
        tableSessionId: session.id,
        tokenHash: hashQrToken(rawToken),
        issuedById: staffId,
      },
    });
    await tx.activeQrToken.upsert({
      where: { tableSessionId: session.id },
      update: { qrTokenId: newToken.id, assignedAt: now },
      create: { tableSessionId: session.id, qrTokenId: newToken.id, assignedAt: now },
    });
    await tx.tableSessionEvent.create({
      data: { tableSessionId: session.id, eventType: "QR_TOKEN_ROTATED", actorStaffId: staffId, metadata: { replacedTokenId: activeQr?.qrTokenId ?? null } },
    });
    return { token: rawToken };
  });
}

export async function listTables(storeId: string) {
  const now = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP(3) AS now`;
  const currentTime = now[0]?.now ?? new Date();
  const tables = await prisma.diningTable.findMany({
    where: { storeId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      activeSession: { include: { tableSession: true } },
    },
  });
  return {
    serverNow: currentTime.toISOString(),
    tables: tables.map((table) => {
    const session = table.activeSession?.tableSession;
    return {
      ...table,
      effectiveStatus: getEffectiveTableStatus(
        session?.lifecycleStatus ?? null,
        session?.startedAt ?? null,
        session?.endsAt ?? null,
        currentTime,
      ),
      activeSession: session,
    };
    }),
  };
}

export async function setTableCount(storeId: string, count: number) {
  return prisma.$transaction(async (tx) => {
    // Lock every existing numbered table in one deterministic order before
    // reading isActive/activeSession or changing the managed table set. This
    // serializes with openTableSession and prevents deactivating an occupied
    // table.
    const lockedTables = await lockNumberedTables(tx, storeId);
    const tables = await tx.diningTable.findMany({
      where: { storeId },
      include: { activeSession: true },
    });
    const lockedTableIds = new Set(lockedTables.map((table) => table.id));
    const numberedTables = tables.filter((table) => lockedTableIds.has(table.id));
    const tablesToDisable = numberedTables.filter((table) => Number(table.tableNumber) > count);
    const occupiedTables = tablesToDisable.filter((table) => table.activeSession);

    if (occupiedTables.length > 0) {
      const tableNames = occupiedTables
        .sort((left, right) => Number(left.tableNumber) - Number(right.tableNumber))
        .map((table) => table.displayName)
        .join(", ");
      throw new HttpError(409, "TABLES_IN_USE", `ไม่สามารถลดจำนวนโต๊ะได้ เพราะ ${tableNames} กำลังใช้งานอยู่`);
    }

    for (let number = 1; number <= count; number += 1) {
      const tableNumber = String(number);
      await tx.diningTable.upsert({
        where: { storeId_tableNumber: { storeId, tableNumber } },
        update: { displayName: `โต๊ะ ${number}`, capacity: null, sortOrder: number, isActive: true },
        create: { storeId, tableNumber, displayName: `โต๊ะ ${number}`, capacity: null, sortOrder: number, isActive: true },
      });
    }

    if (tablesToDisable.length > 0) {
      await tx.diningTable.updateMany({
        where: { id: { in: tablesToDisable.map((table) => table.id) } },
        data: { isActive: false },
      });
    }

    return { count };
  });
}
