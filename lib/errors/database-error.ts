export function mapDatabaseError(error: unknown): { code: string; message: string } | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = String((error as { code?: unknown }).code);
  if (code === "P2002") {
    const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? "");
    if (target.includes("table_id")) return { code: "TABLE_ALREADY_IN_USE", message: "โต๊ะนี้กำลังถูกใช้งาน" };
    if (target.includes("idempotency_key")) return { code: "IDEMPOTENCY_CONFLICT", message: "คำขอนี้กำลังถูกประมวลผลซ้ำ" };
    return { code: "CONFLICT", message: "ข้อมูลนี้ถูกใช้งานอยู่แล้ว" };
  }
  if (code === "P2025") return { code: "NOT_FOUND", message: "ไม่พบข้อมูลที่ต้องการ" };
  return null;
}
