import assert from "node:assert/strict";
import { getEffectiveTableStatus } from "@/lib/time/effective-status";
import { assertOrderingWindow } from "@/lib/time/effective-status";
import { imageStorage } from "@/lib/storage/images";

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
console.log("domain status checks passed");
