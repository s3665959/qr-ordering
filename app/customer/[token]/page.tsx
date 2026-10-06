"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type MenuItem = { id: string; name: string; description: string | null; servingUnit: string; imageKey: string | null; imageUrl?: string | null; sortOrder: number };
type Category = { id: string; name: string; description: string | null; items: MenuItem[] };
type OrderItem = { itemNameSnapshot: string; servingUnitSnapshot: string; quantity: number };
type Order = { id: string; orderNumber: string; status: string; orderedAt: string; items: OrderItem[] };
type Session = { tableName: string; packageName: string; allowsBeefOrdering: boolean; lifecycleStatus: string; effectiveStatus: string; startedAt: string | null; endsAt: string | null };
type Payload = { session: Session; menu: Category[]; orders: Order[] };
type Tab = "menu" | "orders";

const sessionStatusLabels: Record<string, string> = { ACTIVE: "กำลังสั่งอาหาร", ENDING_SOON: "ใกล้หมดเวลา", TIME_EXPIRED: "หมดเวลาแล้ว", PAID_PENDING_START: "รอพนักงานเริ่มโต๊ะ", CLOSED: "ปิดรอบแล้ว", CANCELLED: "ยกเลิกแล้ว" };
const customerOrderStatusLabels: Record<string, string> = { NEW: "รอรับออเดอร์", ACCEPTED: "รับออเดอร์แล้ว", SERVED: "เสิร์ฟแล้ว", CANCELLED: "ยกเลิก", PREPARING: "กำลังเตรียม", DELIVERING: "กำลังนำมาเสิร์ฟ" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "omit", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload?.error?.message ?? "ไม่สามารถเชื่อมต่อระบบได้") as Error & { status?: number }; error.status = response.status; throw error; }
  return payload as T;
}

function timeLeft(endsAt: string | null, now: number) {
  if (!endsAt) return "รอเริ่มจับเวลา";
  const seconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (!seconds) return "หมดเวลาแล้ว";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} ชม. ${minutes} นาที` : `${minutes} นาที ${seconds % 60} วินาที`;
}

function formatOrderTime(value: string) { return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

function OrderHistory({ orders }: { orders: Order[] }) {
  if (!orders.length) return <div className={styles.empty}>ยังไม่มีออเดอร์ของโต๊ะนี้</div>;
  return <div className={styles.orderList}>{orders.map((order) => <details className={styles.order} key={order.id}>
    <summary><span><strong>ออเดอร์ {order.orderNumber}</strong><small>{formatOrderTime(order.orderedAt)} · {order.items.length} เมนู</small></span><b className={styles.orderStatus}>{customerOrderStatusLabels[order.status] || order.status}</b></summary>
    <div className={styles.orderDetails}><ul>{order.items.map((item, index) => <li key={`${item.itemNameSnapshot}-${index}`}><span>{item.itemNameSnapshot} <small>({item.servingUnitSnapshot})</small></span><b>{item.quantity} หน่วย</b></li>)}</ul><small className={styles.fullOrderNumber}>เลขออเดอร์เต็ม: {order.orderNumber}</small></div>
  </details>)}</div>;
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
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [tab, setTab] = useState<Tab>("menu");
  const [categoryId, setCategoryId] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const sheetRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    try { const result = await api<Payload>(`/api/customer/sessions/${encodeURIComponent(token)}`); setData(result); setSessionUnavailable(false); setError(""); }
    catch (cause) { if (cause instanceof Error && "status" in cause && cause.status === 404) setSessionUnavailable(true); setError(cause instanceof Error ? cause.message : "QR นี้ไม่สามารถใช้งานได้"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); const poll = window.setInterval(() => void refresh(), 5000); return () => { window.clearTimeout(timer); window.clearInterval(poll); }; }, [refresh]);
  useEffect(() => { const first = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearTimeout(first); window.clearInterval(timer); }; }, []);
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    returnFocusRef.current = previous;
    const focusFirst = window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>("button, [tabindex='0']")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSheetOpen(false); return; }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusables = Array.from(sheetRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), [tabindex='0']"));
      if (!focusables.length) return;
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(focusFirst); document.removeEventListener("keydown", onKeyDown); };
  }, [sheetOpen]);
  useEffect(() => { if (!sheetOpen && returnFocusRef.current) { returnFocusRef.current.focus(); returnFocusRef.current = null; } }, [sheetOpen]);

  const items = useMemo(() => data?.menu.flatMap((category) => category.items) ?? [], [data]);
  const selectedCategoryId = categoryId !== "all" && data?.menu.some((category) => category.id === categoryId) ? categoryId : "all";
  const visibleCategories = useMemo(() => data?.menu.filter((category) => selectedCategoryId === "all" || category.id === selectedCategoryId) ?? [], [data, selectedCategoryId]);
  const menuCount = Object.keys(cart).length;
  const unitCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const canOrder = !sessionUnavailable && (data?.session.effectiveStatus === "ACTIVE" || data?.session.effectiveStatus === "ENDING_SOON");

  function changeQuantity(itemId: string, delta: number) {
    if (!canOrder || submitting) return;
    setCart((current) => { const next = Math.max(0, Math.min(99, (current[itemId] ?? 0) + delta)); const result = { ...current }; if (next) result[itemId] = next; else delete result[itemId]; return result; });
  }

  function openSheet() { returnFocusRef.current = document.activeElement as HTMLElement | null; setSheetOpen(true); }
  async function submitOrder() {
    if (!unitCount || !canOrder || submitting) return;
    setSubmitting(true); setError(""); setMessage("");
    try { await api(`/api/customer/sessions/${encodeURIComponent(token)}/orders`, { method: "POST", body: JSON.stringify({ idempotencyKey: `${crypto.randomUUID()}-${Date.now()}`, items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity })) }) }); setCart({}); setSheetOpen(false); setMessage("ส่งออเดอร์แล้ว ร้านกำลังดำเนินการ"); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งออเดอร์ไม่สำเร็จ"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className={styles.center}>กำลังเปิดเมนู…</main>;
  if (!data) return <main className={styles.center}><section className={styles.errorCard}><span className={styles.eyebrow}>SHABU QR</span><h1>เปิด QR ไม่สำเร็จ</h1><p>{error || "QR นี้อาจหมดอายุหรือถูกยกเลิกแล้ว"}</p><button className={styles.primaryButton} onClick={() => { setLoading(true); void refresh(); }}>ลองใหม่</button></section></main>;

  const session = data.session;
  const unavailableReason = sessionUnavailable || session.effectiveStatus === "CLOSED" || session.effectiveStatus === "CANCELLED" ? "รอบนี้ปิดแล้ว" : session.effectiveStatus === "TIME_EXPIRED" ? "หมดเวลารับออเดอร์แล้ว" : "ตอนนี้ยังสั่งอาหารไม่ได้ กรุณารอพนักงานเริ่มโต๊ะ";
  return <main className={styles.shell}>
    <header className={styles.hero}><div className={styles.heroTop}><span className={styles.eyebrow}>SHABU QR</span><span className={`${styles.status} ${session.effectiveStatus === "ENDING_SOON" ? styles.warning : ""}`}>{sessionStatusLabels[session.effectiveStatus] || session.effectiveStatus}</span></div><h1>{session.tableName}</h1><div className={styles.headerMeta}><span>แพ็กเกจ {session.packageName}</span><strong>{timeLeft(session.endsAt, now)}</strong></div></header>
    {(error || message) && <div className={error ? styles.alertError : styles.alertSuccess} role="status">{error || message}</div>}
    {!canOrder && <div className={styles.notice} role="alert">{unavailableReason}</div>}
    <nav className={styles.tabs} aria-label="เมนูและออเดอร์"><button className={tab === "menu" ? styles.activeTab : ""} aria-current={tab === "menu" ? "page" : undefined} onClick={() => setTab("menu")}>สั่งอาหาร <span>{items.length}</span></button><button className={tab === "orders" ? styles.activeTab : ""} aria-current={tab === "orders" ? "page" : undefined} onClick={() => setTab("orders")}>ออเดอร์ของโต๊ะ <span>{data.orders.length}</span></button></nav>
    {tab === "menu" ? <div className={styles.menuArea}><section className={styles.menuPanel}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ORDER MENU</span><h2>เลือกเมนู</h2></div><span>{items.length} รายการ</span></div>{data.menu.length > 0 && <div className={styles.categoryFilters} aria-label="เลือกหมวดอาหาร"><button className={selectedCategoryId === "all" ? styles.selectedCategory : ""} onClick={() => setCategoryId("all")}>ทั้งหมด</button>{data.menu.map((category) => <button className={selectedCategoryId === category.id ? styles.selectedCategory : ""} key={category.id} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}</div>}{visibleCategories.length ? visibleCategories.map((category) => <section className={styles.category} key={category.id}><div className={styles.categoryHeading}><h3>{category.name}</h3>{category.description && <span>{category.description}</span>}</div><div className={styles.itemGrid}>{category.items.map((item) => <article className={styles.item} key={item.id}>{item.imageUrl && !failedImages[item.id] ? <img src={item.imageUrl} alt={item.name} className={styles.image} onError={() => setFailedImages((current) => ({ ...current, [item.id]: true }))} /> : <div className={styles.imagePlaceholder} aria-hidden="true">SHABU</div>}<div className={styles.itemBody}><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}<span>{item.servingUnit}</span></div><div className={styles.stepper}><button aria-label={`ลด ${item.name}`} disabled={!canOrder || submitting || !cart[item.id]} onClick={() => changeQuantity(item.id, -1)}>−</button><b aria-label={`จำนวน ${cart[item.id] || 0}`}>{cart[item.id] || 0}</b><button aria-label={`เพิ่ม ${item.name}`} disabled={!canOrder || submitting} onClick={() => changeQuantity(item.id, 1)}>+</button></div></article>)}</div></section>) : <div className={styles.empty}>หมวดนี้ยังไม่มีเมนูเปิดขาย</div>}</section><aside className={styles.desktopCart}><CartContents cart={cart} items={items} unitCount={unitCount} menuCount={menuCount} canOrder={Boolean(canOrder)} submitting={submitting} changeQuantity={changeQuantity} submitOrder={() => void submitOrder()} /></aside></div> : <section className={styles.ordersPanel}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TABLE ORDERS</span><h2>ออเดอร์ของโต๊ะ</h2></div><span>{data.orders.length} ออเดอร์</span></div><OrderHistory orders={data.orders} /></section>}
    {tab === "menu" && <button className={styles.stickyCart} disabled={!unitCount} onClick={openSheet}><span><strong>ตะกร้า</strong><small>{menuCount} เมนู · {unitCount} หน่วยรวม</small></span><b>ตรวจรายการ</b></button>}
    {sheetOpen && <div className={styles.sheetBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheetOpen(false); }}><div className={styles.bottomSheet} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className={styles.sheetHandle} /><div className={styles.sheetHeader}><div><span className={styles.eyebrow}>YOUR CART</span><h2 id="cart-title">ตรวจตะกร้า</h2></div><button className={styles.closeButton} aria-label="ปิดตะกร้า" onClick={() => setSheetOpen(false)}>×</button></div>{!canOrder && <div className={styles.sheetWarning}>{unavailableReason} ปุ่มส่งออเดอร์ถูกปิดไว้</div>}<CartContents cart={cart} items={items} unitCount={unitCount} menuCount={menuCount} canOrder={Boolean(canOrder)} submitting={submitting} changeQuantity={changeQuantity} submitOrder={() => void submitOrder()} /></div></div>}
    <footer className={styles.footer}>ข้อมูลอัปเดตอัตโนมัติทุก 5 วินาที · หากต้องการความช่วยเหลือ กรุณาแจ้งพนักงาน</footer>
  </main>;
}

function CartContents({ cart, items, unitCount, menuCount, canOrder, submitting, changeQuantity, submitOrder }: { cart: Record<string, number>; items: MenuItem[]; unitCount: number; menuCount: number; canOrder: boolean; submitting: boolean; changeQuantity: (id: string, delta: number) => void; submitOrder: () => void }) {
  return <><div className={styles.cartSummary}><strong>{menuCount} เมนู</strong><span>{unitCount} หน่วยรวม</span></div><div className={styles.cart}>{unitCount ? Object.entries(cart).map(([id, quantity]) => { const item = items.find((candidate) => candidate.id === id); return item ? <div className={styles.cartLine} key={id}><div><strong>{item.name}</strong><small>{item.servingUnit}</small></div><div className={styles.cartControls}><button aria-label={`ลด ${item.name}`} disabled={!canOrder || submitting} onClick={() => changeQuantity(id, -1)}>−</button><b>{quantity}</b><button aria-label={`เพิ่ม ${item.name}`} disabled={!canOrder || submitting} onClick={() => changeQuantity(id, 1)}>+</button></div></div> : null; }) : <div className={styles.empty}>ยังไม่ได้เลือกเมนู<br /><small>กด + ที่รายการที่ต้องการ</small></div>}</div><button className={styles.submit} disabled={!unitCount || !canOrder || submitting} onClick={submitOrder}>{submitting ? "กำลังส่งออเดอร์…" : "ยืนยันส่งออเดอร์"}</button></>;
}
