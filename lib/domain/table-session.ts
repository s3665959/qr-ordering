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

function assertAmount(actual: number, expected: number) {
  if (Math.abs(actual - expected) > 0.005) {
    throw new HttpError(400, "PAYMENT_AMOUNT_MISMATCH", "ยอดชำระไม่ตรงกับยอดที่คำนวณ");
  }
}

export async function openTableSession(
  input: {
    storeId: string;
    staffId: string;
    tableId: string;
    packageId: string;
    guestCount: number;
    payment: { amount: number; method: string; reference?: string; notes?: string };
  },
) {
  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findFirst({
      where: { id: input.tableId, storeId: input.storeId, isActive: true },
    });
    if (!table) throw new HttpError(404, "TABLE_NOT_FOUND", "ไม่พบโต๊ะ");

    const tablePointer = await tx.activeTableSession.findUnique({ where: { tableId: table.id } });
    if (tablePointer) throw new HttpError(409, "TABLE_ALREADY_IN_USE", "โต๊ะนี้กำลังถูกใช้งาน");

    const buffetPackage = await tx.buffetPackage.findFirst({
      where: { id: input.packageId, storeId: input.storeId, isActive: true },
    });
    if (!buffetPackage) throw new HttpError(404, "PACKAGE_NOT_FOUND", "ไม่พบแพ็กเกจ");

    const totalAmount = Number(buffetPackage.pricePerPerson) * input.guestCount;
    assertAmount(input.payment.amount, totalAmount);

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

    await tx.payment.create({
      data: {
        tableSessionId: session.id,
        amount: input.payment.amount,
        method: input.payment.method,
        reference: input.payment.reference,
        notes: input.payment.notes,
        status: "CONFIRMED",
        paidAt: await databaseNow(tx),
        receivedById: input.staffId,
      },
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
        eventType: "TABLE_OPENED_AND_PAID",
        actorStaffId: input.staffId,
        metadata: { packageCode: buffetPackage.code, hasQr: Boolean(qrToken) },
      },
    });

    return { session, qrToken };
  });
}

export async function startTableSession(sessionId: string, staffId: string, storeId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({
      where: { id: sessionId, storeId },
      include: { payments: { where: { status: "CONFIRMED" } } },
    });
    if (!session) throw new HttpError(404, "TABLE_SESSION_NOT_FOUND", "ไม่พบรอบโต๊ะ");
    if (session.lifecycleStatus !== "PAID_PENDING_START") {
      throw new HttpError(409, "TABLE_SESSION_NOT_STARTABLE", "รอบโต๊ะนี้เริ่มหรือปิดไปแล้ว");
    }
    if (session.payments.length === 0) {
      throw new HttpError(409, "PAYMENT_NOT_CONFIRMED", "ยังไม่มีการยืนยันการชำระเงิน");
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
