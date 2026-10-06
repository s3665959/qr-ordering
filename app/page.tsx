"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type TableStatus = "AVAILABLE" | "PAID_PENDING_START" | "ACTIVE" | "ENDING_SOON" | "TIME_EXPIRED" | "CLOSED" | "CANCELLED";
type TableSession = { id: string; packageNameSnapshot: string; totalAmount: number | string; guestCount: number; lifecycleStatus: string; startedAt: string | null; endsAt: string | null; allowsBeefOrderingSnapshot: boolean; effectiveStatus: TableStatus };
type Table = { id: string; tableNumber: string; displayName: string; capacity: number | null; effectiveStatus: TableStatus; activeSession: TableSession | null };
type BuffetPackage = { id: string; name: string; pricePerPerson: number | string; durationMinutes: number; allowsBeefOrdering: boolean };
type Staff = { displayName: string; permissions: string[] } | null;

const statusLabels: Record<TableStatus, string> = { AVAILABLE: "ว่าง", PAID_PENDING_START: "รอเริ่มใช้", ACTIVE: "กำลังใช้งาน", ENDING_SOON: "ใกล้หมดเวลา", TIME_EXPIRED: "ครบเวลา", CLOSED: "ปิดรอบแล้ว", CANCELLED: "ยกเลิก" };
const statusClass: Record<TableStatus, string> = { AVAILABLE: styles.statusAvailable, PAID_PENDING_START: styles.statusPending, ACTIVE: styles.statusActive, ENDING_SOON: styles.statusWarning, TIME_EXPIRED: styles.statusExpired, CLOSED: styles.statusClosed, CANCELLED: styles.statusClosed };

function money(value: number | string) { return Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 }); }
function remainingLabel(endsAt: string | null, nowMs: number) {
  if (!endsAt) return "ยังไม่เริ่มจับเวลา";
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - nowMs) / 1000));
  if (seconds <= 0) return "ครบเวลาแล้ว";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours > 0 ? `${hours}ชม. ` : ""}${minutes}น. ${(seconds % 60).toString().padStart(2, "0")}วิ`;
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "ไม่สามารถเชื่อมต่อระบบได้");
  return payload as T;
}

export default function Home() {
  const [staff, setStaff] = useState<Staff>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [packages, setPackages] = useState<BuffetPackage[]>([]);
  const [serverOffset, setServerOffset] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [openForm, setOpenForm] = useState({ tableNumber: "", packageId: "", guestCount: 2, method: "เงินสด" });
  const [tableCount, setTableCount] = useState("");
  const [savingTableCount, setSavingTableCount] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ staff: Staff }>("/api/auth/me");
      if (!me.staff) { setAuthRequired(true); setLoading(false); return; }
      setAuthRequired(false);
      const [tableResult, packageResult] = await Promise.all([api<{ tables: Table[]; serverNow: string }>("/api/staff/tables"), api<{ packages: BuffetPackage[] }>("/api/staff/packages")]);
      setStaff(me.staff); setTables(tableResult.tables); setPackages(packageResult.packages);
      setServerOffset(new Date(tableResult.serverNow).getTime() - Date.now()); setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้";
      if (message.includes("เข้าสู่ระบบ")) setAuthRequired(true); else setError(message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const first = window.setTimeout(() => void refresh(), 0); const poll = window.setInterval(() => void refresh(), 2000); return () => { window.clearTimeout(first); window.clearInterval(poll); }; }, [refresh]);
  useEffect(() => { const first = window.setTimeout(() => setNowMs(Date.now() + serverOffset), 0); const timer = window.setInterval(() => setNowMs(Date.now() + serverOffset), 1000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [serverOffset]);

  const selectedTable = useMemo(() => tables.find((table) => table.tableNumber === openForm.tableNumber), [openForm.tableNumber, tables]);
  const canManageSettings = Boolean(staff?.permissions.includes("SETTINGS_MANAGE"));
  const selectedPackage = packages.find((item) => item.id === openForm.packageId);
  const estimatedTotal = selectedPackage ? Number(selectedPackage.pricePerPerson) * openForm.guestCount : 0;

  async function openTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!openForm.tableNumber || !openForm.packageId) return;
    if (!selectedTable) { setError(`ไม่พบโต๊ะหมายเลข ${openForm.tableNumber}`); return; }
    if (selectedTable.effectiveStatus !== "AVAILABLE") { setError(`โต๊ะ ${openForm.tableNumber} กำลังใช้งานหรือยังไม่ว่าง`); return; }
    setSubmitting(true); setActionMessage("");
    try {
      await api("/api/staff/table-sessions", { method: "POST", body: JSON.stringify({ tableId: selectedTable.id, packageId: openForm.packageId, guestCount: openForm.guestCount, payment: { amount: estimatedTotal, method: openForm.method } }) });
      setActionMessage("เปิดรอบและบันทึกการชำระเงินแล้ว สามารถกดเริ่มใช้โต๊ะได้"); setOpenForm({ tableNumber: "", packageId: "", guestCount: 2, method: "เงินสด" }); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปิดรอบไม่สำเร็จ"); } finally { setSubmitting(false); }
  }
  async function saveTableCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(tableCount);
    if (!Number.isInteger(count) || count < 1 || count > 200) { setError("จำนวนโต๊ะต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 200"); return; }
    setSavingTableCount(true); setActionMessage("");
    try {
      await api("/api/staff/tables", { method: "POST", body: JSON.stringify({ count }) });
      setTableCount(""); setActionMessage(`ตั้งจำนวนโต๊ะเป็น ${count} โต๊ะแล้ว`); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ตั้งจำนวนโต๊ะไม่สำเร็จ"); } finally { setSavingTableCount(false); }
  }
  async function sessionAction(sessionId: string, action: "start" | "close" | "extend") {
    setActionMessage("");
    try {
      const body = action === "extend" ? JSON.stringify({ minutes: 30, reason: "ต่อเวลาโดยผู้จัดการ/แคชเชียร์" }) : undefined;
      await api(`/api/staff/table-sessions/${sessionId}/${action}`, { method: "POST", body });
      setActionMessage(action === "start" ? "เริ่มจับเวลาแล้ว" : action === "close" ? "ปิดรอบและเพิกถอน QR แล้ว" : "ต่อเวลา 30 นาทีแล้ว"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ"); }
  }
  async function printQr(sessionId: string) {
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const result = await api<{ qrToken: string }>(`/api/staff/table-sessions/${sessionId}/qr`, { method: "POST" });
      const target = `/qr/${encodeURIComponent(result.qrToken)}`;
      if (popup) popup.location.href = target; else window.open(target, "_blank", "noopener,noreferrer");
    } catch (cause) {
      popup?.close(); setError(cause instanceof Error ? cause.message : "สร้าง QR ไม่สำเร็จ");
    }
  }

  if (loading) return <main className={styles.loading}>กำลังโหลดผังโต๊ะ…</main>;
  if (authRequired) return <main className={styles.authGate}><div className={styles.authCard}><span className={styles.eyebrow}>SHABU CONTROL</span><h1>เข้าสู่ระบบพนักงาน</h1><p>หน้านี้ใช้สำหรับแคชเชียร์และผู้จัดการ กรุณาเข้าสู่ระบบก่อนจัดการโต๊ะ</p><a className={styles.primaryButton} href="/login">ไปหน้าเข้าสู่ระบบ</a></div></main>;

  const displayNowMs = nowMs || 0;
  const activeCount = tables.filter((table) => ["ACTIVE", "ENDING_SOON"].includes(table.effectiveStatus)).length;
  const expiredCount = tables.filter((table) => table.effectiveStatus === "TIME_EXPIRED").length;
  return <main className={styles.shell}>
    <header className={styles.header}><div><span className={styles.eyebrow}>SHABU CONTROL / FRONT DESK</span><h1>ผังโต๊ะและเปิดรอบ</h1><p>จัดการการชำระเงิน เริ่มใช้โต๊ะ และติดตามเวลาจาก Backend</p></div><div className={styles.staffBadge}><a href="/orders">คิวออเดอร์</a><a href="/menu">จัดการเมนู</a><span className={styles.liveDot} />{staff?.displayName ?? "พนักงาน"}</div></header>
    {(error || actionMessage) && <div className={error ? styles.alertError : styles.alertSuccess}>{error || actionMessage}</div>}
    <section className={styles.summary} aria-label="สรุปสถานะโต๊ะ"><div><span>โต๊ะทั้งหมด</span><strong>{tables.length}</strong></div><div><span>กำลังใช้งาน</span><strong>{activeCount}</strong></div><div><span>ครบเวลา รอปิด</span><strong className={expiredCount ? styles.dangerText : ""}>{expiredCount}</strong></div><div><span>อัปเดตล่าสุด</span><strong className={styles.clock}>{displayNowMs ? new Date(displayNowMs).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div></section>
    <div className={styles.workspace}>
      <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>LIVE FLOOR</span><h2>ผังโต๊ะ</h2></div><span className={styles.polling}><span className={styles.liveDot} />อัปเดตทุก 2 วินาที</span></div>{canManageSettings && <form className={styles.settingsForm} onSubmit={saveTableCount}><label>จำนวนโต๊ะ<input type="number" min="1" max="200" step="1" value={tableCount} onChange={(event) => setTableCount(event.target.value)} placeholder="เช่น 20 หรือ 50" required /></label><button className={styles.secondaryButton} disabled={savingTableCount}>{savingTableCount ? "กำลังบันทึก…" : "บันทึกจำนวนโต๊ะ"}</button></form>}<div className={styles.tableGrid}>
        {tables.map((table) => { const session = table.activeSession; const status = table.effectiveStatus; return <article className={`${styles.tableCard} ${status === "TIME_EXPIRED" ? styles.cardExpired : ""}`} key={table.id}><div className={styles.tableTop}><span className={styles.tableNumber}>{table.displayName}</span><span className={`${styles.status} ${statusClass[status]}`}>{statusLabels[status]}</span></div>{session ? <><div className={styles.packageLine}>{session.packageNameSnapshot}<span>{session.guestCount} คน</span></div><div className={styles.timer}>{remainingLabel(session.endsAt, nowMs)}</div><div className={styles.timerMeta}>{session.startedAt ? `เริ่ม ${new Date(session.startedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : "ชำระเงินแล้ว รอเริ่มใช้โต๊ะ"}</div><div className={styles.cardActions}>{status === "PAID_PENDING_START" && <button className={styles.primaryButton} onClick={() => void sessionAction(session.id, "start")}>เริ่มใช้โต๊ะ</button>}{session.allowsBeefOrderingSnapshot && status !== "CLOSED" && status !== "CANCELLED" && <button className={styles.secondaryButton} onClick={() => void printQr(session.id)}>พิมพ์ QR</button>}{status !== "PAID_PENDING_START" && status !== "CLOSED" && status !== "CANCELLED" && <button className={styles.secondaryButton} onClick={() => void sessionAction(session.id, "extend")}>ต่อ 30 นาที</button>}{status !== "CLOSED" && status !== "CANCELLED" && <button className={styles.textButton} onClick={() => void sessionAction(session.id, "close")}>ปิดรอบ</button>}</div></> : <div className={styles.emptyTable}>พร้อมรับลูกค้า</div>}</article>; })}
        {!tables.length && <div className={styles.emptyState}>ยังไม่มีโต๊ะที่เปิดใช้งานในสาขานี้{canManageSettings ? " — กรอกจำนวนโต๊ะด้านบนเพื่อสร้างโต๊ะ 1 ถึงจำนวนที่ต้องการ" : " — กรุณาแจ้งผู้มีสิทธิ์ SETTINGS_MANAGE ให้ตั้งจำนวนโต๊ะ"}</div>}
      </div></section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>CHECKOUT</span><h2>เปิดรอบใหม่</h2></div></div><form className={styles.openForm} onSubmit={openTable}><label>หมายเลขโต๊ะ<input type="number" min="1" max="200" step="1" value={openForm.tableNumber} onChange={(event) => setOpenForm((current) => ({ ...current, tableNumber: event.target.value }))} placeholder="เช่น 12" required /></label><label>แพ็กเกจทั้งโต๊ะ<select value={openForm.packageId} onChange={(event) => setOpenForm((current) => ({ ...current, packageId: event.target.value }))} required><option value="">เลือกแพ็กเกจ</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.pricePerPerson)} บาท/คน{item.allowsBeefOrdering ? " · มี QR เนื้อ" : ""}</option>)}</select></label><label>จำนวนลูกค้า<input type="number" min="1" max="100" value={openForm.guestCount} onChange={(event) => setOpenForm((current) => ({ ...current, guestCount: Number(event.target.value) }))} required /></label><label>วิธีชำระเงิน<select value={openForm.method} onChange={(event) => setOpenForm((current) => ({ ...current, method: event.target.value }))}><option>เงินสด</option><option>QR/โอน</option><option>บัตร</option><option>อื่น ๆ</option></select></label><div className={styles.totalBox}><span>ยอดที่ต้องชำระ</span><strong>{money(estimatedTotal)} บาท</strong><small>QR จะออกได้เมื่อชำระเงินสำเร็จ แต่ยังสั่งไม่ได้จนกดเริ่มใช้โต๊ะ</small></div><button className={styles.submitButton} disabled={submitting || !openForm.tableNumber || !openForm.packageId}>{submitting ? "กำลังบันทึก…" : "ยืนยันการชำระและเปิดรอบ"}</button></form></section>
    </div>
  </main>;
}
