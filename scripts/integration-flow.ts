import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

const expectedAppUrl = "https://qr-order.test";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

function assertIntegrationConfiguration() {
  const missing = [
    ["TEST_DATABASE_URL", testDatabaseUrl],
    ["DATABASE_URL", databaseUrl],
    ["AUTH_SESSION_SECRET", process.env.AUTH_SESSION_SECRET],
    ["QR_TOKEN_PEPPER", process.env.QR_TOKEN_PEPPER],
    ["LOCAL_IMAGE_STORAGE_PATH", process.env.LOCAL_IMAGE_STORAGE_PATH],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new Error(`Integration configuration is missing: ${missing.join(", ")}`);
  if (databaseUrl !== testDatabaseUrl) throw new Error("DATABASE_URL must equal TEST_DATABASE_URL for integration tests");
  if (process.env.NEXT_PUBLIC_APP_URL !== expectedAppUrl) {
    throw new Error(`Integration server must use NEXT_PUBLIC_APP_URL=${expectedAppUrl}`);
  }

  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(parsedBaseUrl.hostname)) {
    throw new Error("TEST_BASE_URL must point to a local HTTP server (127.0.0.1, localhost, or ::1)");
  }

  const parsedDatabaseUrl = new URL(testDatabaseUrl!);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsedDatabaseUrl.hostname)) {
    throw new Error("TEST_DATABASE_URL must point to a local test database");
  }
}

// Run all checks before creating Prisma or any fixture rows. A bad server
// configuration must fail before the script can mutate the test database.
assertIntegrationConfiguration();
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(testDatabaseUrl!) });
const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const password = `phase7-local-${suffix}`;

type Json = Record<string, unknown>;

async function api(path: string, init: RequestInit = {}, cookie = "") {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function expectStatus(response: Response, expected: number, body: unknown) {
  assert.equal(response.status, expected, `expected ${expected}, got ${response.status}: ${JSON.stringify(body)}`);
}

function cookieFrom(response: Response) {
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function main() {
  const store = await prisma.store.findUniqueOrThrow({ where: { code: "MAIN" } });
  const packages = await prisma.buffetPackage.findMany({ where: { storeId: store.id }, orderBy: { code: "asc" } });
  const pork = packages.find((item) => item.code === "PORK");
  const beef = packages.find((item) => item.code === "PORK_BEEF");
  assert(pork && beef, "seed packages are required");

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: "OWNER" } });
  const serverRole = await prisma.role.findUniqueOrThrow({ where: { code: "SERVER" } });
  const owner = await prisma.staffUser.create({
    data: {
      storeId: store.id,
      username: `phase7-owner-${suffix}`,
      passwordHash: await hashPassword(password),
      displayName: "เฟส 7 เจ้าของร้าน",
      roles: { create: { roleId: ownerRole.id } },
    },
  });
  const restricted = await prisma.staffUser.create({
    data: {
      storeId: store.id,
      username: `phase7-server-${suffix}`,
      passwordHash: await hashPassword(password),
      displayName: "เฟส 7 พนักงานจำกัดสิทธิ์",
      roles: { create: { roleId: serverRole.id } },
    },
  });

  const tables = await Promise.all([
    prisma.diningTable.create({ data: { storeId: store.id, tableNumber: `F7-P-${suffix}`, displayName: `เฟส 7 หมู ${suffix}`, sortOrder: 900 } }),
    prisma.diningTable.create({ data: { storeId: store.id, tableNumber: `F7-B-${suffix}`, displayName: `เฟส 7 เนื้อ ${suffix}`, sortOrder: 901 } }),
    prisma.diningTable.create({ data: { storeId: store.id, tableNumber: `F7-C-${suffix}`, displayName: `เฟส 7 พร้อมกัน ${suffix}`, sortOrder: 902 } }),
  ]);

  const ownerLogin = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: owner.username, password }) });
  expectStatus(ownerLogin.response, 200, ownerLogin.body);
  const ownerCookie = cookieFrom(ownerLogin.response);
  assert(ownerCookie, "owner session cookie missing");

  const setTables = async (count: number) => {
    const result = await api("/api/staff/tables", { method: "POST", body: JSON.stringify({ count }) }, ownerCookie);
    expectStatus(result.response, 200, result.body);
    assert.equal((result.body as Json).count, count);
  };
  const assertNoInactiveOccupiedTables = async (label: string) => {
    const violations = await prisma.$queryRaw<Array<{ id: string; tableNumber: string }>>`
      SELECT dining_tables.id, dining_tables.table_number AS tableNumber
      FROM dining_tables
      INNER JOIN active_table_sessions ON active_table_sessions.table_id = dining_tables.id
      WHERE dining_tables.store_id = ${store.id} AND dining_tables.is_active = false
    `;
    assert.equal(violations.length, 0, `${label}: inactive tables must not have active sessions: ${JSON.stringify(violations)}`);
  };
  await setTables(20);
  const twentyTables = await prisma.diningTable.findMany({ where: { storeId: store.id, tableNumber: { in: Array.from({ length: 20 }, (_, index) => String(index + 1)) } } });
  assert.equal(twentyTables.length, 20, "setting 20 tables must create tables 1-20");
  assert(twentyTables.every((table) => table.isActive && table.capacity === null), "managed tables must be active and have no capacity");
  await setTables(20);
  assert.equal(await prisma.diningTable.count({ where: { storeId: store.id, tableNumber: { in: Array.from({ length: 20 }, (_, index) => String(index + 1)) } } }), 20, "repeating the same count must not duplicate tables");
  await setTables(50);
  assert.equal(await prisma.diningTable.count({ where: { storeId: store.id, isActive: true, tableNumber: { in: Array.from({ length: 50 }, (_, index) => String(index + 1)) } } }), 50, "setting 50 tables must activate tables 1-50");

  const table21 = await prisma.diningTable.findFirstOrThrow({ where: { storeId: store.id, tableNumber: "21" } });
  const numberOpen = await api("/api/staff/table-sessions", { method: "POST", body: JSON.stringify({ tableId: table21.id, packageId: pork.id, guestCount: 3, payment: { amount: 897, method: "test" } }) }, ownerCookie);
  expectStatus(numberOpen.response, 201, numberOpen.body);
  const numberSessionId = String(((numberOpen.body as Json).session as Json).id);
  const numberClosed = await api(`/api/staff/table-sessions/${numberSessionId}/close`, { method: "POST" }, ownerCookie);
  expectStatus(numberClosed.response, 200, numberClosed.body);
  await setTables(20);
  const historicalTable21 = await prisma.diningTable.findUniqueOrThrow({ where: { id: table21.id } });
  assert.equal(historicalTable21.isActive, false, "reducing count must deactivate tables above the new count");
  assert(await prisma.tableSession.findUnique({ where: { id: numberSessionId } }), "reducing count must preserve table session history");

  const table20 = await prisma.diningTable.findFirstOrThrow({ where: { storeId: store.id, tableNumber: "20" } });
  const activeNumberOpen = await api("/api/staff/table-sessions", { method: "POST", body: JSON.stringify({ tableId: table20.id, packageId: pork.id, guestCount: 2, payment: { amount: 598, method: "test" } }) }, ownerCookie);
  expectStatus(activeNumberOpen.response, 201, activeNumberOpen.body);
  const activeNumberSessionId = String(((activeNumberOpen.body as Json).session as Json).id);
  const blockedReduction = await api("/api/staff/tables", { method: "POST", body: JSON.stringify({ count: 19 }) }, ownerCookie);
  expectStatus(blockedReduction.response, 409, blockedReduction.body);
  assert(String((blockedReduction.body as Json).error && ((blockedReduction.body as Json).error as Json).message).includes("โต๊ะ 20"), "blocked reduction must name the occupied table");
  const activeTable20 = await prisma.diningTable.findUniqueOrThrow({ where: { id: table20.id } });
  assert.equal(activeTable20.isActive, true, "blocked reduction must not deactivate the occupied table");
  const activeNumberClosed = await api(`/api/staff/table-sessions/${activeNumberSessionId}/close`, { method: "POST" }, ownerCookie);
  expectStatus(activeNumberClosed.response, 200, activeNumberClosed.body);
  await setTables(19);
  assert.equal((await prisma.diningTable.findUniqueOrThrow({ where: { id: table20.id } })).isActive, false);

  const reductionBeforeOpen = await api("/api/staff/table-sessions", {
    method: "POST",
    body: JSON.stringify({ tableId: table20.id, packageId: pork.id, guestCount: 2, payment: { amount: 598, method: "test" } }),
  }, ownerCookie);
  expectStatus(reductionBeforeOpen.response, 404, reductionBeforeOpen.body);
  assert.equal(await prisma.activeTableSession.findUnique({ where: { tableId: table20.id } }), null, "a reduced table must not get an active session");

  const concurrentOpen = () => api("/api/staff/table-sessions", {
    method: "POST",
    body: JSON.stringify({ tableId: table20.id, packageId: pork.id, guestCount: 2, payment: { amount: 598, method: "concurrency-test" } }),
  }, ownerCookie);
  const concurrentReduce = () => api("/api/staff/tables", {
    method: "POST",
    body: JSON.stringify({ count: 19 }),
  }, ownerCookie);

  for (let round = 1; round <= 12; round += 1) {
    await setTables(20);
    const [openResult, reduceResult] = await Promise.all([concurrentOpen(), concurrentReduce()]);
    const outcome = `${openResult.response.status}/${reduceResult.response.status}`;
    assert(
      (openResult.response.status === 201 && reduceResult.response.status === 409) ||
        (openResult.response.status === 404 && reduceResult.response.status === 200),
      `concurrency round ${round} must serialize as open/reduce 201/409 or 404/200, got ${outcome}: ${JSON.stringify({ open: openResult.body, reduce: reduceResult.body })}`,
    );
    assert.notDeepEqual([openResult.response.status, reduceResult.response.status], [201, 200], `concurrency round ${round} must not let both requests succeed`);

    if (openResult.response.status === 201) {
      const sessionId = String(((openResult.body as Json).session as Json).id);
      const closed = await api(`/api/staff/table-sessions/${sessionId}/close`, { method: "POST" }, ownerCookie);
      expectStatus(closed.response, 200, closed.body);
    }
    await assertNoInactiveOccupiedTables(`concurrency round ${round}`);
    await setTables(20);
    await assertNoInactiveOccupiedTables(`concurrency round ${round} after restore`);
  }

  const throttleIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const failed = await api("/api/auth/login", { method: "POST", headers: { "x-forwarded-for": throttleIp }, body: JSON.stringify({ username: owner.username, password: "wrong-password" }) });
    expectStatus(failed.response, 401, failed.body);
  }
  const locked = await api("/api/auth/login", { method: "POST", headers: { "x-forwarded-for": throttleIp }, body: JSON.stringify({ username: owner.username, password }) });
  expectStatus(locked.response, 429, locked.body);
  await prisma.loginThrottle.deleteMany({ where: { staffUserId: owner.id } });

  const restrictedLogin = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: restricted.username, password }) });
  expectStatus(restrictedLogin.response, 200, restrictedLogin.body);
  const restrictedCookie = cookieFrom(restrictedLogin.response);
  const forbidden = await api("/api/staff/table-sessions", {
    method: "POST",
    body: JSON.stringify({ tableId: tables[0].id, packageId: pork.id, guestCount: 1, payment: { amount: 299, method: "test" } }),
  }, restrictedCookie);
  expectStatus(forbidden.response, 403, forbidden.body);
  const settingsForbidden = await api("/api/staff/tables", { method: "POST", body: JSON.stringify({ count: 20 }) }, restrictedCookie);
  expectStatus(settingsForbidden.response, 403, settingsForbidden.body);

  const categoryResponse = await api("/api/staff/menu/categories", {
    method: "POST",
    body: JSON.stringify({ name: `เฟส 7 หมวด ${suffix}`, description: "integration test", sortOrder: 900 }),
  }, ownerCookie);
  expectStatus(categoryResponse.response, 201, categoryResponse.body);
  const category = categoryResponse.body.category as Json;
  const categoryId = String(category.id);
  const categoryPatch = await api(`/api/staff/menu/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: `เฟส 7 หมวดแก้ไข ${suffix}`, description: "updated" }),
  }, ownerCookie);
  expectStatus(categoryPatch.response, 200, categoryPatch.body);

  const itemResponse = await api("/api/staff/menu/items", {
    method: "POST",
    body: JSON.stringify({ categoryId, name: `เนื้อทดสอบ ${suffix}`, description: "phase 7", servingUnit: "ถาด", imageKey: `/uploads/phase7/${suffix}.jpg`, sortOrder: 1, isAvailable: true }),
  }, ownerCookie);
  expectStatus(itemResponse.response, 201, itemResponse.body);
  const itemId = String((itemResponse.body.item as Json).id);
  const unavailable = await api(`/api/staff/menu/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ isAvailable: false }) }, ownerCookie);
  expectStatus(unavailable.response, 200, unavailable.body);
  assert.equal((unavailable.body.item as Json).imageKey, `/uploads/phase7/${suffix}.jpg`);
  const available = await api(`/api/staff/menu/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ isAvailable: true, name: `เนื้อทดสอบเปิดขาย ${suffix}` }) }, ownerCookie);
  expectStatus(available.response, 200, available.body);

  const open = async (tableId: string, packageId: string, amount: number) => {
    const result = await api("/api/staff/table-sessions", { method: "POST", body: JSON.stringify({ tableId, packageId, guestCount: 1, payment: { amount, method: "test" } }) }, ownerCookie);
    expectStatus(result.response, 201, result.body);
    return result.body as { session: Json; qrToken: string | null };
  };
  const start = async (sessionId: string) => {
    const result = await api(`/api/staff/table-sessions/${sessionId}/start`, { method: "POST" }, ownerCookie);
    expectStatus(result.response, 200, result.body);
  };

  const porkSession = await open(tables[0].id, pork.id, 299);
  assert.equal(porkSession.qrToken, null, "pork package must not issue QR");
  await start(String(porkSession.session.id));
  const porkClosed = await api(`/api/staff/table-sessions/${porkSession.session.id}/close`, { method: "POST" }, ownerCookie);
  expectStatus(porkClosed.response, 200, porkClosed.body);

  const beefSession = await open(tables[1].id, beef.id, 349);
  assert(beefSession.qrToken, "pork+beef package must issue QR");
  const beefId = String(beefSession.session.id);
  const beforeStart = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, { method: "POST", body: JSON.stringify({ idempotencyKey: `phase7-before-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] }) });
  expectStatus(beforeStart.response, 409, beforeStart.body);
  await start(beefId);
  const sessionBefore = await api(`/api/customer/sessions/${beefSession.qrToken}`);
  expectStatus(sessionBefore.response, 200, sessionBefore.body);
  const startedAt = String((sessionBefore.body.session as Json).startedAt);
  const endsAt = String((sessionBefore.body.session as Json).endsAt);
  const orderPayload = { idempotencyKey: `phase7-order-${suffix}`, items: [{ menuItemId: itemId, quantity: 2 }] };
  const orderResult = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, { method: "POST", body: JSON.stringify(orderPayload) });
  expectStatus(orderResult.response, 201, orderResult.body);
  const orderId = String((orderResult.body.order as Json).id);
  const duplicate = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, { method: "POST", body: JSON.stringify(orderPayload) });
  expectStatus(duplicate.response, 201, duplicate.body);
  assert.equal(String((duplicate.body.order as Json).id), orderId, "idempotent retry must return the same order");

  const staffOrders = await api("/api/staff/orders", {}, ownerCookie);
  expectStatus(staffOrders.response, 200, staffOrders.body);
  assert((staffOrders.body.orders as Json[]).some((order) => String(order.id) === orderId), "staff queue must show new order");
  const accepted = await api(`/api/staff/orders/${orderId}/status`, { method: "POST", body: JSON.stringify({ status: "ACCEPTED" }) }, ownerCookie);
  expectStatus(accepted.response, 200, accepted.body);
  const oldFlowRejected = await api(`/api/staff/orders/${orderId}/status`, { method: "POST", body: JSON.stringify({ status: "PREPARING" }) }, ownerCookie);
  expectStatus(oldFlowRejected.response, 400, oldFlowRejected.body);

  const newOrderResult = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: `phase7-direct-serve-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] }),
  });
  expectStatus(newOrderResult.response, 201, newOrderResult.body);
  const newOrderId = String((newOrderResult.body.order as Json).id);
  const directServe = await api(`/api/staff/orders/${newOrderId}/status`, { method: "POST", body: JSON.stringify({ status: "SERVED" }) }, ownerCookie);
  expectStatus(directServe.response, 409, directServe.body);
  const cancelled = await api(`/api/staff/orders/${newOrderId}/status`, { method: "POST", body: JSON.stringify({ status: "CANCELLED", reason: "history fixture" }) }, ownerCookie);
  expectStatus(cancelled.response, 200, cancelled.body);

  const legacyOrderIds: string[] = [];
  for (const legacyStatus of ["PREPARING", "DELIVERING"] as const) {
    const legacyResult = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `phase7-legacy-${legacyStatus}-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] }),
    });
    expectStatus(legacyResult.response, 201, legacyResult.body);
    const legacyOrderId = String((legacyResult.body.order as Json).id);
    legacyOrderIds.push(legacyOrderId);
    await prisma.order.update({
      where: { id: legacyOrderId },
      data: { status: legacyStatus, statusEvents: { create: { fromStatus: "NEW", toStatus: legacyStatus, reason: "legacy fixture" } } },
    });
  }
  const legacyQueue = await api("/api/staff/orders", {}, ownerCookie);
  expectStatus(legacyQueue.response, 200, legacyQueue.body);
  assert(legacyOrderIds.every((id) => (legacyQueue.body.orders as Json[]).some((order) => String(order.id) === id && ["PREPARING", "DELIVERING"].includes(String(order.status)))), "legacy orders must remain visible in the queue");

  const refreshed = await api(`/api/customer/sessions/${beefSession.qrToken}`);
  expectStatus(refreshed.response, 200, refreshed.body);
  assert.equal(String((refreshed.body.session as Json).startedAt), startedAt, "refresh must not restart timer");
  assert.equal(String((refreshed.body.session as Json).endsAt), endsAt, "device refresh must preserve endsAt");

  await prisma.tableSession.update({ where: { id: beefId }, data: { endsAt: new Date(Date.now() - 60_000) } });
  const afterExpiry = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, { method: "POST", body: JSON.stringify({ idempotencyKey: `phase7-after-expiry-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] }) });
  expectStatus(afterExpiry.response, 409, afterExpiry.body);
  const served = await Promise.all([
    api(`/api/staff/orders/${orderId}/status`, { method: "POST", body: JSON.stringify({ status: "SERVED" }) }, ownerCookie),
    api(`/api/staff/orders/${orderId}/status`, { method: "POST", body: JSON.stringify({ status: "SERVED" }) }, ownerCookie),
  ]);
  assert.deepEqual(served.map((result) => result.response.status).sort((a, b) => a - b), [200, 409], "concurrent order status updates must allow one winner");
  for (const legacyOrderId of legacyOrderIds) {
    const changed = await api(`/api/staff/orders/${legacyOrderId}/status`, { method: "POST", body: JSON.stringify({ status: "SERVED" }) }, ownerCookie);
    expectStatus(changed.response, 200, changed.body);
  }
  const beforeBusinessDay = new Date("2026-10-06T20:59:00.000Z");
  const afterBusinessDay = new Date("2026-10-06T21:01:00.000Z");
  await prisma.order.update({ where: { id: orderId }, data: { orderedAt: beforeBusinessDay, servedAt: afterBusinessDay } });
  await prisma.order.update({ where: { id: newOrderId }, data: { orderedAt: beforeBusinessDay, cancelledAt: afterBusinessDay } });
  const servedHistory = await api("/api/staff/orders/history?businessDay=2026-10-07&status=SERVED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(servedHistory.response, 200, servedHistory.body);
  assert((servedHistory.body.orders as Json[]).some((order) => String(order.id) === orderId && String(order.servedAt) === afterBusinessDay.toISOString()), "served history must use servedAt across the 04:00 boundary");
  const previousServedHistory = await api("/api/staff/orders/history?businessDay=2026-10-06&status=SERVED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(previousServedHistory.response, 200, previousServedHistory.body);
  assert(!(previousServedHistory.body.orders as Json[]).some((order) => String(order.id) === orderId), "served history must not use orderedAt");
  const cancelledHistory = await api("/api/staff/orders/history?businessDay=2026-10-07&status=CANCELLED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(cancelledHistory.response, 200, cancelledHistory.body);
  assert((cancelledHistory.body.orders as Json[]).some((order) => String(order.id) === newOrderId && String(order.cancelledAt) === afterBusinessDay.toISOString()), "cancelled history must use cancelledAt");
  const legacyWithoutCompletionTime = legacyOrderIds[0];
  await prisma.order.update({ where: { id: legacyWithoutCompletionTime }, data: { orderedAt: beforeBusinessDay, servedAt: null } });
  const oldHistory = await api("/api/staff/orders/history?businessDay=2026-10-07&status=SERVED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(oldHistory.response, 200, oldHistory.body);
  assert(!(oldHistory.body.orders as Json[]).some((order) => String(order.id) === legacyWithoutCompletionTime), "normal served history must exclude unknown completion times");
  const unknownHistory = await api("/api/staff/orders/history?unknownCompletionTime=1&status=SERVED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(unknownHistory.response, 200, unknownHistory.body);
  assert((unknownHistory.body.orders as Json[]).some((order) => String(order.id) === legacyWithoutCompletionTime && order.servedAt === null), "unknown served history mode must show null servedAt without guessing");
  const unknownCancelledHistory = await api("/api/staff/orders/history?unknownCompletionTime=1&status=CANCELLED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(unknownCancelledHistory.response, 200, unknownCancelledHistory.body);
  await prisma.order.update({ where: { id: newOrderId }, data: { cancelledAt: null } });
  const unknownCancelledHistoryAfterLegacyFixture = await api("/api/staff/orders/history?unknownCompletionTime=1&status=CANCELLED&page=1&pageSize=50", {}, ownerCookie);
  expectStatus(unknownCancelledHistoryAfterLegacyFixture.response, 200, unknownCancelledHistoryAfterLegacyFixture.body);
  assert((unknownCancelledHistoryAfterLegacyFixture.body.orders as Json[]).some((order) => String(order.id) === newOrderId && order.cancelledAt === null), "unknown cancelled history mode must show null cancelledAt without guessing");
  const customerAfterServed = await api(`/api/customer/sessions/${beefSession.qrToken}`);
  expectStatus(customerAfterServed.response, 200, customerAfterServed.body);
  assert.equal(String(((customerAfterServed.body.orders as Json[]).find((order) => String(order.id) === orderId) as Json).status), "SERVED", "customer polling must show the latest order status");

  const concurrentSession = await open(tables[2].id, beef.id, 349);
  assert(concurrentSession.qrToken);
  await start(String(concurrentSession.session.id));
  const concurrentPayload = { idempotencyKey: `phase7-concurrent-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] };
  const concurrent = await Promise.all([
    api(`/api/customer/sessions/${concurrentSession.qrToken}/orders`, { method: "POST", body: JSON.stringify(concurrentPayload) }),
    api(`/api/customer/sessions/${concurrentSession.qrToken}/orders`, { method: "POST", body: JSON.stringify(concurrentPayload) }),
  ]);
  assert(concurrent.every((result) => result.response.status === 201 || result.response.status === 409), "concurrent requests must be handled deterministically");
  const concurrentOrders = await prisma.order.count({ where: { tableSessionId: String(concurrentSession.session.id), idempotencyKey: concurrentPayload.idempotencyKey } });
  assert.equal(concurrentOrders, 1, "concurrent idempotent requests must create one order");

  const closed = await api(`/api/staff/table-sessions/${beefId}/close`, { method: "POST" }, ownerCookie);
  expectStatus(closed.response, 200, closed.body);
  const afterClose = await api(`/api/customer/sessions/${beefSession.qrToken}`);
  expectStatus(afterClose.response, 404, afterClose.body);

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "table count increase/idempotency", "open-before-reduce conflict", "reduce-before-open rejection", "concurrent open/reduce serialization (12 rounds)", "inactive-table invariant", "permission rejection", "database-backed login lockout", "pork package has no QR", "beef package QR", "menu CRUD/image key/availability",
      "pre-start rejection", "customer order and staff queue", "order status workflow", "idempotent retry",
      "expiry behavior", "post-expiry existing order handling", "simplified order transitions", "legacy queue compatibility", "business-day served/cancelled timestamps across 04:00", "old records without completion time", "concurrent status update", "concurrent idempotency", "timer stability", "QR revocation on close",
    ],
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
