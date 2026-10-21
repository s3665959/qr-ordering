import assert from "node:assert/strict";
import { getEffectiveTableStatus } from "@/lib/time/effective-status";
import { assertOrderingWindow } from "@/lib/time/effective-status";
import { imageStorage } from "@/lib/storage/images";
import { mapDatabaseError } from "@/lib/errors/database-error";
import { canTransitionOrderStatus } from "@/lib/order-status";
import { sessionSlipTimes } from "@/lib/time/session-slip";
import { openTableSchema } from "@/lib/validation/api";

async function main() {
const now = new Date("2026-01-01T10:00:00.000Z");
const startedAt = new Date("2026-01-01T08:00:00.000Z");
const endsAt = new Date("2026-01-01T10:00:00.000Z");

assert.equal(getEffectiveTableStatus("PAID_PENDING_START", null, null, now), "PAID_PENDING_START");
assert.equal(
  getEffectiveTableStatus("ACTIVE", startedAt, new Date("2026-01-01T09:50:00.000Z"), now),
  "TIME_EXPIRED",
);
assert.equal(
  getEffectiveTableStatus("ACTIVE", startedAt, new Date("2026-01-01T10:10:00.000Z"), now),
  "ENDING_SOON",
);
assert.equal(
  getEffectiveTableStatus("ACTIVE", startedAt, new Date("2026-01-01T12:00:00.000Z"), now),
  "ACTIVE",
);
assert.equal(getEffectiveTableStatus("CLOSED", startedAt, endsAt, now), "CLOSED");

assert.doesNotThrow(() => assertOrderingWindow("ACTIVE", startedAt, new Date("2026-01-01T10:10:00.000Z"), now));
assert.throws(
  () => assertOrderingWindow("PAID_PENDING_START", null, null, now),
  (error: unknown) => error instanceof Error && error.message === "TABLE_SESSION_NOT_STARTED",
);
assert.throws(
  () => assertOrderingWindow("ACTIVE", startedAt, endsAt, now),
  (error: unknown) => error instanceof Error && error.message === "ORDERING_WINDOW_EXPIRED",
);

assert.equal(imageStorage.publicUrl("/uploads/menu/pork.jpg"), "/uploads/menu/pork.jpg");
assert.equal(imageStorage.publicUrl("https://cdn.example.test/pork.jpg"), "https://cdn.example.test/pork.jpg");
assert.equal(imageStorage.publicUrl("s3://private-bucket/pork.jpg"), null);
assert.deepEqual(mapDatabaseError({ code: "P2002", meta: { target: ["table_id"] } }), { code: "TABLE_ALREADY_IN_USE", message: "โต๊ะนี้กำลังถูกใช้งาน" });
assert.deepEqual(mapDatabaseError({ code: "P2002", meta: { target: ["unknown_field"] } }), { code: "CONFLICT", message: "ข้อมูลนี้ถูกใช้งานอยู่แล้ว" });
assert(canTransitionOrderStatus("NEW", "ACCEPTED"));
assert(canTransitionOrderStatus("ACCEPTED", "SERVED"));
assert(canTransitionOrderStatus("PREPARING", "SERVED"));
assert(canTransitionOrderStatus("DELIVERING", "SERVED"));
assert(!canTransitionOrderStatus("NEW", "SERVED"));
assert(!canTransitionOrderStatus("SERVED", "ACCEPTED"));
assert(!canTransitionOrderStatus("ACCEPTED", "PREPARING"));
const opening = { tableId: "00000000-0000-4000-8000-000000000001", packageId: "00000000-0000-4000-8000-000000000002" };
assert(openTableSchema.safeParse({ ...opening, adultCount: 3, childCount: 2, guestCount: 5 }).success);
assert(openTableSchema.safeParse({ ...opening, adultCount: 0, childCount: 1, guestCount: 1 }).success);
for (const counts of [
  { adultCount: 0, childCount: 0, guestCount: 0 },
  { adultCount: -1, childCount: 2, guestCount: 1 },
  { adultCount: 1.5, childCount: 0, guestCount: 1.5 },
  { adultCount: 3, childCount: 2, guestCount: 4 },
  { adultCount: 99, childCount: 2, guestCount: 101 },
]) assert(!openTableSchema.safeParse({ ...opening, ...counts }).success);
assert.deepEqual(sessionSlipTimes(new Date("2026-10-21T11:21:38Z"), new Date("2026-10-21T11:21:38Z"), new Date("2026-10-21T13:21:38Z")), {
  date: "21-10-2026", startedAt: "18:21:38", endsAt: "20:21:38",
});
assert.deepEqual(sessionSlipTimes(new Date("2026-10-21T16:00:00Z"), new Date("2026-10-21T16:59:59Z"), new Date("2026-10-21T17:59:59Z")), {
  date: "21-10-2026", startedAt: "23:59:59", endsAt: "00:59:59",
});
assert.deepEqual(sessionSlipTimes(new Date("2026-10-21T11:21:38Z"), null, null), {
  date: "21-10-2026", startedAt: "ยังไม่เริ่ม", endsAt: "ยังไม่เริ่ม",
});
console.log("domain status checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
