"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type Item = { itemNameSnapshot: string; servingUnitSnapshot: string; quantity: number };
type Order = { id: string; orderNumber: string; status: string; orderedAt: string; servedAt: string | null; cancelledAt: string | null; items: Item[]; tableSession: { table: { displayName: string } } };
type Table = { id: string; displayName: string };
const labels: Record<string, string> = { NEW: "ออเดอร์ใหม่", ACCEPTED: "รับออเดอร์แล้ว", PREPARING: "กำลังเตรียม", DELIVERING: "กำลังนำมาเสิร์ฟ", SERVED: "เสิร์ฟแล้ว", CANCELLED: "ยกเลิก" };
const timeZone = "Asia/Bangkok";
const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString("th-TH", { timeZone }) : "ไม่ระบุเวลา";
const formatDate = (value: string) => new Date(`${value}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone, year: "numeric", month: "long", day: "numeric" });

function OrderHistoryContent() {
  const router = useRouter(); const pathname = usePathname(); const search = useSearchParams();
  const businessDay = search.get("businessDay") ?? ""; const tableId = search.get("tableId") ?? ""; const status = search.get("status") ?? ""; const page = Math.max(1, Number(search.get("page") ?? "1") || 1);
  const [orders, setOrders] = useState<Order[]>([]); const [tables, setTables] = useState<Table[]>([]); const [total, setTotal] = useState(0); const [totalPages, setTotalPages] = useState(1); const [businessDayStart, setBusinessDayStart] = useState<string | null>(null); const [expanded, setExpanded] = useState<Set<string>>(new Set()); const [error, setError] = useState("");
  const query = useMemo(() => search.toString(), [search]);
  useEffect(() => { const params = new URLSearchParams(query); if (!params.get("page")) params.set("page", "1"); fetch(`/api/staff/orders/history?${params}`, { credentials: "include" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data?.error?.message ?? "โหลดประวัติไม่สำเร็จ"); return data; }).then((data) => { setOrders(data.orders); setTables(data.tables); setTotal(data.total); setTotalPages(data.totalPages); setBusinessDayStart(data.businessDayStart); if (!businessDay) { const next = new URLSearchParams(params); next.set("businessDay", data.businessDay); router.replace(`${pathname}?${next}`); } setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "โหลดประวัติไม่สำเร็จ")); }, [businessDay, pathname, query, router]);
  function updateFilter(name: string, value: string) { const next = new URLSearchParams(search.toString()); if (value) next.set(name, value); else next.delete(name); next.set("page", "1"); router.replace(`${pathname}?${next}`); }
  function updatePage(nextPage: number) { const next = new URLSearchParams(search.toString()); next.set("page", String(nextPage)); router.replace(`${pathname}?${next}`); }
  return <main className={styles.shell}><header><Link className={styles.back} href="/orders">← กลับหน้าคิว</Link><span className={styles.eyebrow}>SHABU CONTROL / ORDER HISTORY</span><h1>ประวัติออเดอร์</h1><p>วันทำการ {businessDay ? formatDate(businessDay) : "กำลังโหลด…"} · เริ่มวันใหม่ 04:00 น. เวลาไทย{businessDayStart && ` (${formatDateTime(businessDayStart)})`}</p></header>
    <section className={styles.filters}><label>วันทำการ<input type="date" value={businessDay} onChange={(event) => updateFilter("businessDay", event.target.value)} /></label><label>โต๊ะ<select value={tableId} onChange={(event) => updateFilter("tableId", event.target.value)}><option value="">ทุกโต๊ะ</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.displayName}</option>)}</select></label><label>สถานะ<select value={status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></section>
    {error && <div className={styles.error}>{error}</div>}<p className={styles.resultCount}>แสดง {orders.length} จาก {total} รายการ</p><section className={styles.list}>{orders.map((order) => { const isExpanded = expanded.has(order.id); return <article className={styles.card} key={order.id}><div className={styles.cardTop}><strong>{order.tableSession.table.displayName}</strong><span>{labels[order.status] ?? order.status}</span></div><div className={styles.meta}><b>{order.orderNumber}</b><time>สั่ง {formatDateTime(order.orderedAt)}</time>{order.status === "SERVED" && <time>เสิร์ฟ {formatDateTime(order.servedAt)}</time>}{order.status === "CANCELLED" && <time>ยกเลิก {formatDateTime(order.cancelledAt)}</time>}</div><button className={styles.expand} aria-expanded={isExpanded} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(order.id)) next.delete(order.id); else next.add(order.id); return next; })}>{isExpanded ? "ย่อรายการ" : "ดูรายการอาหาร"}</button>{isExpanded && <ul><li>สั่ง {formatDateTime(order.orderedAt)}</li>{order.status === "SERVED" && <li>เสิร์ฟ {formatDateTime(order.servedAt)}</li>}{order.status === "CANCELLED" && <li>ยกเลิก {formatDateTime(order.cancelledAt)}</li>}{order.items.map((item, index) => <li key={`${item.itemNameSnapshot}-${index}`}><b>{item.quantity}×</b> {item.itemNameSnapshot} <small>{item.servingUnitSnapshot}</small></li>)}</ul>}</article>; })}</section><nav className={styles.pagination}><button disabled={page <= 1} onClick={() => updatePage(page - 1)}>ก่อนหน้า</button><span>หน้า {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => updatePage(page + 1)}>ถัดไป</button></nav>
  </main>;
}

export default function OrderHistoryPage() {
  return <Suspense fallback={<main className={styles.shell}>กำลังโหลดประวัติออเดอร์…</main>}><OrderHistoryContent /></Suspense>;
}
