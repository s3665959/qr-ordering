"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { cancellableOrderStatuses, nextOrderStatus, orderActionLabels, orderQueueStatuses, orderStatusLabels } from "@/lib/order-status";

type OrderItem = { itemNameSnapshot: string; servingUnitSnapshot: string; quantity: number };
type Order = { id: string; orderNumber: string; status: string; orderedAt: string; servedAt: string | null; items: OrderItem[]; tableSession: { table: { displayName: string } } };
type Staff = { displayName: string } | null;
type QueueStatus = (typeof orderQueueStatuses)[number];
const legacyOrderStatuses = ["PREPARING", "DELIVERING"] as const;
const timeZone = "Asia/Bangkok";

function queueStatusFor(orderStatus: string): QueueStatus | null {
  if (orderStatus === "NEW" || orderStatus === "SERVED") return orderStatus;
  if (["ACCEPTED", ...legacyOrderStatuses].includes(orderStatus as "ACCEPTED" | (typeof legacyOrderStatuses)[number])) return "ACCEPTED";
  return null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "ไม่สามารถเชื่อมต่อระบบได้");
  return payload as T;
}

function beep() {
  try { const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 740; gain.gain.value = 0.08; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.16); } catch { /* Browser may block audio until a user gesture. */ }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [staff, setStaff] = useState<Staff>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); const [soundEnabled, setSoundEnabled] = useState(false); const [pendingTotal, setPendingTotal] = useState(0); const [servedTotal, setServedTotal] = useState(0); const [businessDay, setBusinessDay] = useState(""); const [businessDayStart, setBusinessDayStart] = useState<string | null>(null); const [expandedServedIds, setExpandedServedIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ staff: Staff }>("/api/auth/me"); setStaff(me.staff);
      const result = await api<{ orders: Order[]; pendingTotal: number; servedTotal: number; businessDay: string; businessDayStart: string }>("/api/staff/orders");
      const incoming = result.orders.filter((order) => order.status === "NEW"); const previousIds = knownIds.current;
      if (previousIds && incoming.some((order) => !previousIds.has(order.id))) { setMessage("มีออเดอร์ใหม่เข้ามา"); if (soundEnabled) beep(); }
      knownIds.current = new Set(result.orders.map((order) => order.id)); setOrders(result.orders); setPendingTotal(result.pendingTotal); setServedTotal(result.servedTotal); setBusinessDay(result.businessDay); setBusinessDayStart(result.businessDayStart); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดคิวออเดอร์ไม่สำเร็จ"); } finally { setLoading(false); }
  }, [soundEnabled]);

  useEffect(() => { const first = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 3000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [refresh]);

  async function changeStatus(order: Order, status: string) {
    if (pendingIds.has(order.id)) return; setPendingIds((current) => new Set(current).add(order.id)); setError("");
    try { await api(`/api/staff/orders/${order.id}/status`, { method: "POST", body: JSON.stringify({ status }) }); setMessage(`${order.orderNumber}: ${orderStatusLabels[status as keyof typeof orderStatusLabels]}`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "เปลี่ยนสถานะไม่สำเร็จ"); } finally { setPendingIds((current) => { const next = new Set(current); next.delete(order.id); return next; }); }
  }

  async function cancel(order: Order) {
    if (pendingIds.has(order.id)) return; const reason = window.prompt("เหตุผลที่ยกเลิกออเดอร์"); if (!reason?.trim()) return;
    setPendingIds((current) => new Set(current).add(order.id)); setError("");
    try { await api(`/api/staff/orders/${order.id}/status`, { method: "POST", body: JSON.stringify({ status: "CANCELLED", reason }) }); setMessage(`${order.orderNumber}: ${orderStatusLabels.CANCELLED}`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ยกเลิกออเดอร์ไม่สำเร็จ"); } finally { setPendingIds((current) => { const next = new Set(current); next.delete(order.id); return next; }); }
  }

  if (loading) return <main className={styles.center}>กำลังโหลดคิวออเดอร์…</main>;
  if (!staff) return <main className={styles.center}><div><h1>กรุณาเข้าสู่ระบบ</h1><Link href="/login">ไปหน้าเข้าสู่ระบบ</Link></div></main>;
  return <main className={styles.shell}><header className={styles.header}><div><Link className={styles.back} href="/">← กลับหน้าผังโต๊ะ</Link><span className={styles.eyebrow}>SHABU CONTROL / ORDER QUEUE</span><h1>คิวออเดอร์</h1><p>ติดตามออเดอร์จาก QR และเปลี่ยนสถานะตามการทำงานของครัว</p></div><div className={styles.headerActions}><Link className={styles.secondaryButton} href="/orders/history">ประวัติออเดอร์</Link><button className={styles.soundButton} onClick={() => { setSoundEnabled((value) => !value); beep(); }}>{soundEnabled ? "🔔 เปิดเสียงแล้ว" : "🔕 เปิดเสียงแจ้งเตือน"}</button><Link className={styles.secondaryButton} href="/">ผังโต๊ะ</Link></div></header>
    {(error || message) && <div className={error ? styles.error : styles.success}>{error || message}</div>}
    <div className={styles.polling}><span />วันทำการ {businessDay} · เริ่มวันใหม่ 04:00 น. (Asia/Bangkok) · เริ่มจริง {businessDayStart ? new Date(businessDayStart).toLocaleString("th-TH", { timeZone }) : "—"} · แสดง {orders.filter((order) => ["NEW", "ACCEPTED", "PREPARING", "DELIVERING"].includes(order.status)).length} จาก {pendingTotal} ออเดอร์ที่ยังไม่เสิร์ฟ</div>
    <div className={styles.board}>{orderQueueStatuses.map((status) => { const columnOrders = orders.filter((order) => queueStatusFor(order.status) === status); return <section className={styles.column} key={status}><div className={styles.columnHeader}><h2>{status === "SERVED" ? `เสิร์ฟแล้ว (${servedTotal})` : orderStatusLabels[status]}</h2><b>{columnOrders.length}</b></div>{columnOrders.map((order) => { const nextStatus = nextOrderStatus[order.status]; const pending = pendingIds.has(order.id); const isLegacy = legacyOrderStatuses.includes(order.status as (typeof legacyOrderStatuses)[number]); const served = order.status === "SERVED"; const expanded = expandedServedIds.has(order.id); return <article className={`${styles.card} ${order.status === "NEW" ? styles.newCard : ""}`} key={order.id}><div className={styles.tableBanner}>{order.tableSession.table.displayName}</div><div className={styles.cardMeta}><strong>{served ? (expanded ? order.orderNumber : "เสิร์ฟแล้ว") : order.orderNumber}</strong>{isLegacy && <span className={styles.legacyBadge}>{orderStatusLabels[order.status as keyof typeof orderStatusLabels]}</span>}<time>{new Date(served && order.servedAt ? order.servedAt : order.orderedAt).toLocaleTimeString("th-TH", { timeZone, hour: "2-digit", minute: "2-digit" })}</time></div>{served && expanded && <div className={styles.expandedTimes}>สั่ง {new Date(order.orderedAt).toLocaleString("th-TH", { timeZone })} · เสิร์ฟ {order.servedAt ? new Date(order.servedAt).toLocaleString("th-TH", { timeZone }) : "ไม่ระบุเวลาเสิร์ฟ"}</div>}{(!served || expanded) && <ul>{order.items.map((item, index) => <li key={`${item.itemNameSnapshot}-${index}`}><b>{item.quantity}×</b> {item.itemNameSnapshot}<small>{item.servingUnitSnapshot}</small></li>)}</ul>}{served ? <button type="button" aria-expanded={expanded} className={styles.expandButton} onClick={() => setExpandedServedIds((current) => { const next = new Set(current); if (next.has(order.id)) next.delete(order.id); else next.add(order.id); return next; })}>{expanded ? "ย่อ" : "Expand"}</button> : <div className={styles.cardActions}>{nextStatus && <button className={styles.primaryButton} disabled={pending} onClick={() => void changeStatus(order, nextStatus)}>{pending ? "กำลังบันทึก…" : orderActionLabels[nextStatus]}</button>}{cancellableOrderStatuses.includes(order.status as typeof cancellableOrderStatuses[number]) && <button className={styles.cancelButton} disabled={pending} onClick={() => void cancel(order)}>ยกเลิก</button>}</div>}</article>; })}{status === "SERVED" && <Link className={styles.viewAll} href={`/orders/history?businessDay=${businessDay}&status=SERVED`}>ดูทั้งหมด</Link>}</section>; })}</div>
    <footer className={styles.footer}>ผู้ปฏิบัติงาน: {staff.displayName} · ออเดอร์ที่เสิร์ฟแล้วจะแสดงไว้เพื่ออ้างอิง · <Link className={styles.viewAll} href="/orders/history">ประวัติออเดอร์</Link></footer>
  </main>;
}
