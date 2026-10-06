"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type MenuItem = { id: string; name: string; description: string | null; servingUnit: string; imageKey: string | null; imageUrl?: string | null; sortOrder: number };
type Category = { id: string; name: string; description: string | null; items: MenuItem[] };
type Order = { id: string; orderNumber: string; status: string; orderedAt: string; items: Array<{ itemNameSnapshot: string; servingUnitSnapshot: string; quantity: number }> };
type Session = { tableName: string; packageName: string; allowsBeefOrdering: boolean; lifecycleStatus: string; effectiveStatus: string; startedAt: string | null; endsAt: string | null };
type Payload = { session: Session; menu: Category[]; orders: Order[] };

const statusLabels: Record<string, string> = { ACTIVE: "กำลังใช้บริการ", ENDING_SOON: "ใกล้หมดเวลา", TIME_EXPIRED: "หมดเวลาแล้ว", PAID_PENDING_START: "รอพนักงานเริ่มโต๊ะ", CLOSED: "ปิดรอบแล้ว", CANCELLED: "ยกเลิกแล้ว" };
const orderStatusLabels: Record<string, string> = { NEW: "รอรับออเดอร์", ACCEPTED: "รับออเดอร์แล้ว", PREPARING: "กำลังเตรียม", DELIVERING: "กำลังนำมาเสิร์ฟ", SERVED: "เสิร์ฟแล้ว", CANCELLED: "ยกเลิก" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "omit", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "ไม่สามารถเชื่อมต่อระบบได้");
  return payload as T;
}

function timeLeft(endsAt: string | null, now: number) {
  if (!endsAt) return "รอเริ่มจับเวลา";
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (!seconds) return "หมดเวลาแล้ว";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours} ชม. ` : ""}${minutes} นาที`;
}

export default function CustomerOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await api<Payload>(`/api/customer/sessions/${encodeURIComponent(token)}`);
      setData(result); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "QR นี้ไม่สามารถใช้งานได้"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); const poll = window.setInterval(() => void refresh(), 5000); return () => { window.clearTimeout(timer); window.clearInterval(poll); }; }, [refresh]);
  useEffect(() => { const first = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, []);

  const items = useMemo(() => data?.menu.flatMap((category) => category.items) ?? [], [data]);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const canOrder = data?.session.effectiveStatus === "ACTIVE" || data?.session.effectiveStatus === "ENDING_SOON";

  function changeQuantity(itemId: string, delta: number) {
    setCart((current) => { const next = Math.max(0, Math.min(99, (current[itemId] ?? 0) + delta)); const result = { ...current }; if (next) result[itemId] = next; else delete result[itemId]; return result; });
  }

  async function submitOrder() {
    if (!cartCount || !canOrder || submitting) return;
    setSubmitting(true); setError(""); setMessage("");
    try {
      await api(`/api/customer/sessions/${encodeURIComponent(token)}/orders`, { method: "POST", body: JSON.stringify({ idempotencyKey: `${crypto.randomUUID()}-${Date.now()}`, items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity })) }) });
      setCart({}); setMessage("ส่งออเดอร์แล้ว ร้านกำลังดำเนินการ"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งออเดอร์ไม่สำเร็จ"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className={styles.center}>กำลังเปิดเมนู…</main>;
  if (!data) return <main className={styles.center}><section className={styles.errorCard}><span className={styles.eyebrow}>SHABU QR</span><h1>เปิด QR ไม่สำเร็จ</h1><p>{error || "QR นี้อาจหมดอายุหรือถูกยกเลิกแล้ว"}</p></section></main>;

  const session = data.session;
  return <main className={styles.shell}>
    <header className={styles.hero}><span className={styles.eyebrow}>SHABU QR / CUSTOMER MENU</span><h1>{session.tableName}</h1><p>{session.packageName} · เมนูสั่งเนื้อสำหรับโต๊ะนี้</p><div className={styles.statusRow}><span className={`${styles.status} ${session.effectiveStatus === "ENDING_SOON" ? styles.warning : ""}`}>{statusLabels[session.effectiveStatus] || session.effectiveStatus}</span><strong>{timeLeft(session.endsAt, now)}</strong></div></header>
    {(error || message) && <div className={error ? styles.alertError : styles.alertSuccess}>{error || message}</div>}
    {!canOrder && <div className={styles.notice}>ตอนนี้ยังสั่งอาหารไม่ได้ กรุณารอพนักงานเริ่มใช้โต๊ะ หรือแจ้งพนักงานหากหมดเวลา</div>}
    <div className={styles.layout}><section className={styles.menuPanel}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ORDER MENU</span><h2>เลือกเมนู</h2></div><span>{items.length} รายการ</span></div>{data.menu.length ? data.menu.map((category) => <section className={styles.category} key={category.id}><div className={styles.categoryHeading}><h3>{category.name}</h3><span>{category.description}</span></div><div className={styles.itemGrid}>{category.items.map((item) => <article className={styles.item} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" className={styles.image} onError={(event) => { event.currentTarget.hidden = true; }} /> : <div className={styles.imagePlaceholder}>SHABU</div>}<div className={styles.itemBody}><strong>{item.name}</strong><small>{item.description || item.servingUnit}</small><span>{item.servingUnit}</span></div><div className={styles.stepper}><button aria-label={`ลด ${item.name}`} disabled={!canOrder || !cart[item.id]} onClick={() => changeQuantity(item.id, -1)}>−</button><b>{cart[item.id] || 0}</b><button aria-label={`เพิ่ม ${item.name}`} disabled={!canOrder} onClick={() => changeQuantity(item.id, 1)}>+</button></div></article>)}</div></section>) : <div className={styles.empty}>ยังไม่มีเมนูเปิดขาย</div>}</section>
      <aside className={styles.orderPanel}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>YOUR ORDER</span><h2>รายการที่เลือก</h2></div><span>{cartCount} รายการ</span></div><div className={styles.cart}>{cartCount ? Object.entries(cart).map(([id, quantity]) => { const item = items.find((candidate) => candidate.id === id); return item ? <div className={styles.cartLine} key={id}><div><strong>{item.name}</strong><small>{item.servingUnit}</small></div><div className={styles.cartControls}><button onClick={() => changeQuantity(id, -1)}>−</button><b>{quantity}</b><button onClick={() => changeQuantity(id, 1)}>+</button></div></div> : null; }) : <div className={styles.empty}>ยังไม่ได้เลือกเมนู<br /><small>กด + ที่รายการที่ต้องการ</small></div>}</div><button className={styles.submit} disabled={!cartCount || !canOrder || submitting} onClick={() => void submitOrder()}>{submitting ? "กำลังส่งออเดอร์…" : "ส่งออเดอร์"}</button><div className={styles.orders}><h3>ออเดอร์ล่าสุด</h3>{data.orders.slice(0, 5).map((order) => <article className={styles.order} key={order.id}><div><strong>{order.orderNumber}</strong><span>{orderStatusLabels[order.status] || order.status}</span></div><small>{order.items.map((item) => `${item.itemNameSnapshot} × ${item.quantity}`).join(", ")}</small></article>)}</div></aside>
    </div>
    <footer className={styles.footer}>หากต้องการความช่วยเหลือ กรุณาแจ้งพนักงานที่โต๊ะ · ข้อมูลนี้อัปเดตอัตโนมัติ</footer>
  </main>;
}
