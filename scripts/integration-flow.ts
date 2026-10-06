import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
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

  const refreshed = await api(`/api/customer/sessions/${beefSession.qrToken}`);
  expectStatus(refreshed.response, 200, refreshed.body);
  assert.equal(String((refreshed.body.session as Json).startedAt), startedAt, "refresh must not restart timer");
  assert.equal(String((refreshed.body.session as Json).endsAt), endsAt, "device refresh must preserve endsAt");

  await prisma.tableSession.update({ where: { id: beefId }, data: { endsAt: new Date(Date.now() - 60_000) } });
  const afterExpiry = await api(`/api/customer/sessions/${beefSession.qrToken}/orders`, { method: "POST", body: JSON.stringify({ idempotencyKey: `phase7-after-expiry-${suffix}`, items: [{ menuItemId: itemId, quantity: 1 }] }) });
  expectStatus(afterExpiry.response, 409, afterExpiry.body);
  for (const status of ["PREPARING", "DELIVERING", "SERVED"]) {
    const changed = await api(`/api/staff/orders/${orderId}/status`, { method: "POST", body: JSON.stringify({ status }) }, ownerCookie);
    expectStatus(changed.response, 200, changed.body);
  }

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
      "permission rejection", "database-backed login lockout", "pork package has no QR", "beef package QR", "menu CRUD/image key/availability",
      "pre-start rejection", "customer order and staff queue", "order status workflow", "idempotent retry",
      "expiry behavior", "post-expiry existing order handling", "concurrent idempotency", "timer stability", "QR revocation on close",
    ],
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
