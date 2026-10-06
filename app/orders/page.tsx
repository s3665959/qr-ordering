"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type OrderItem = { itemNameSnapshot: string; servingUnitSnapshot: string; quantity: number };
type Order = { id: string; orderNumber: string; status: string; orderedAt: string; items: OrderItem[]; tableSession: { table: { displayName: string } } };
type Staff = { displayName: string } | null;

const labels: Record<string, string> = { NEW: "ออเดอร์ใหม่", ACCEPTED: "รับออเดอร์แล้ว", PREPARING: "กำลังเตรียม", DELIVERING: "กำลังเสิร์ฟ", SERVED: "เสิร์ฟแล้ว", CANCELLED: "ยกเลิก" };
const columns = ["NEW", "ACCEPTED", "PREPARING", "DELIVERING", "SERVED"];
const nextStatus: Record<string, string | undefined> = { NEW: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "DELIVERING", DELIVERING: "SERVED" };

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<Staff>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ staff: Staff }>("/api/auth/me");
      setStaff(me.staff);
      const result = await api<{ orders: Order[] }>("/api/staff/orders");
      const incoming = result.orders.filter((order) => order.status === "NEW");
      const previousIds = knownIds.current;
      if (previousIds && incoming.some((order) => !previousIds.has(order.id))) {
        setMessage("มีออเดอร์ใหม่เข้ามา"); if (soundEnabled) beep();
      }
      knownIds.current = new Set(result.orders.map((order) => order.id));
      setOrders(result.orders); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดคิวออเดอร์ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [soundEnabled]);

  useEffect(() => { const first = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 3000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, [refresh]);

  async function changeStatus(order: Order, status: string) {
    try { await api(`/api/staff/orders/${order.id}/status`, { method: "POST", body: JSON.stringify({ status }) }); setMessage(`${order.orderNumber}: ${labels[status]}`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "เปลี่ยนสถานะไม่สำเร็จ"); }
  }

  async function cancel(order: Order) {
    const reason = window.prompt("เหตุผลที่ยกเลิกออเดอร์");
    if (!reason?.trim()) return;
    try { await api(`/api/staff/orders/${order.id}/status`, { method: "POST", body: JSON.stringify({ status: "CANCELLED", reason }) }); setMessage(`${order.orderNumber}: ยกเลิกแล้ว`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ยกเลิกออเดอร์ไม่สำเร็จ"); }
  }

  if (loading) return <main className={styles.center}>กำลังโหลดคิวออเดอร์…</main>;
  if (!staff) return <main className={styles.center}><div><h1>กรุณาเข้าสู่ระบบ</h1><Link href="/login">ไปหน้าเข้าสู่ระบบ</Link></div></main>;
  return <main className={styles.shell}><header className={styles.header}><div><Link className={styles.back} href="/">← กลับหน้าผังโต๊ะ</Link><span className={styles.eyebrow}>SHABU CONTROL / ORDER QUEUE</span><h1>คิวออเดอร์</h1><p>ติดตามออเดอร์จาก QR และเปลี่ยนสถานะตามการทำงานของครัว</p></div><div className={styles.headerActions}><button className={styles.soundButton} onClick={() => { setSoundEnabled((value) => !value); beep(); }}>{soundEnabled ? "🔔 เปิดเสียงแล้ว" : "🔕 เปิดเสียงแจ้งเตือน"}</button><Link className={styles.secondaryButton} href="/">ผังโต๊ะ</Link></div></header>
    {(error || message) && <div className={error ? styles.error : styles.success}>{error || message}</div>}
    <div className={styles.polling}><span />อัปเดตอัตโนมัติทุก 3 วินาที · {orders.filter((order) => ["NEW", "ACCEPTED", "PREPARING", "DELIVERING"].includes(order.status)).length} ออเดอร์ที่ยังไม่เสิร์ฟ</div>
    <div className={styles.board}>{columns.map((status) => <section className={styles.column} key={status}><div className={styles.columnHeader}><h2>{labels[status]}</h2><b>{orders.filter((order) => order.status === status).length}</b></div>{orders.filter((order) => order.status === status).map((order) => <article className={`${styles.card} ${status === "NEW" ? styles.newCard : ""}`} key={order.id}><div className={styles.cardTop}><strong>{order.orderNumber}</strong><span>{order.tableSession.table.displayName}</span></div><time>{new Date(order.orderedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time><ul>{order.items.map((item, index) => <li key={`${item.itemNameSnapshot}-${index}`}><b>{item.quantity}×</b> {item.itemNameSnapshot}<small>{item.servingUnitSnapshot}</small></li>)}</ul><div className={styles.cardActions}>{nextStatus[status] && <button className={styles.primaryButton} onClick={() => void changeStatus(order, nextStatus[status] as string)}>{labels[nextStatus[status] as string]}</button>}{["NEW", "ACCEPTED", "PREPARING"].includes(status) && <button className={styles.cancelButton} onClick={() => void cancel(order)}>ยกเลิก</button>}</div></article>)}</section>)}</div>
    <footer className={styles.footer}>ผู้ปฏิบัติงาน: {staff.displayName} · ออเดอร์ที่เสิร์ฟแล้วจะแสดงไว้เพื่ออ้างอิง</footer>
  </main>;
}
