"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Category = { id: string; name: string; description: string | null; sortOrder: number; isActive: boolean; items: Item[] };
type Item = { id: string; categoryId: string; name: string; description: string | null; servingUnit: string; imageKey: string | null; imageUrl?: string | null; sortOrder: number; isActive: boolean; isAvailable: boolean; category?: Category };
type CategoryForm = { name: string; description: string; sortOrder: number };
type ItemForm = { categoryId: string; name: string; description: string; servingUnit: string; imageKey: string; sortOrder: number; isAvailable: boolean };

const blankCategory: CategoryForm = { name: "", description: "", sortOrder: 0 };
const blankItem: ItemForm = { categoryId: "", name: "", description: "", servingUnit: "จาน", imageKey: "", sortOrder: 0, isAvailable: true };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? "ดำเนินการไม่สำเร็จ");
  return payload as T;
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);
  const [itemForm, setItemForm] = useState<ItemForm>(blankItem);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ categories: Category[] }>("/api/staff/menu/categories");
      const itemResult = await api<{ items: Item[] }>("/api/staff/menu/items");
      setCategories(result.categories);
      setItems(itemResult.items);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดเมนูไม่สำเร็จ");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  const activeCategories = useMemo(() => categories.filter((category) => category.isActive), [categories]);

  function notify(text: string) { setMessage(text); setError(""); window.setTimeout(() => setMessage(""), 2500); }

  async function saveCategory(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const url = editingCategory ? `/api/staff/menu/categories/${editingCategory}` : "/api/staff/menu/categories";
      await api(url, { method: editingCategory ? "PATCH" : "POST", body: JSON.stringify(categoryForm) });
      setCategoryForm(blankCategory); setEditingCategory(null); notify(editingCategory ? "แก้ไขหมวดหมู่แล้ว" : "เพิ่มหมวดหมู่แล้ว"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกหมวดหมู่ไม่สำเร็จ"); } finally { setBusy(false); }
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const url = editingItem ? `/api/staff/menu/items/${editingItem}` : "/api/staff/menu/items";
      await api(url, { method: editingItem ? "PATCH" : "POST", body: JSON.stringify(itemForm) });
      setItemForm({ ...blankItem, categoryId: itemForm.categoryId }); setEditingItem(null); notify(editingItem ? "แก้ไขสินค้าแล้ว" : "เพิ่มสินค้าแล้ว"); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกสินค้าไม่สำเร็จ"); } finally { setBusy(false); }
  }

  async function archive(url: string, label: string) {
    if (!window.confirm(`ยืนยันปิดใช้งาน${label}นี้? ข้อมูลออเดอร์เก่าจะยังคงอยู่`)) return;
    try { await api(url, { method: "DELETE" }); notify(`ปิดใช้งาน${label}แล้ว`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ปิดใช้งานไม่สำเร็จ"); }
  }

  if (loading) return <main className={styles.center}>กำลังโหลดเมนู…</main>;
  return <main className={styles.shell}>
    <header className={styles.header}><div><Link className={styles.back} href="/">← กลับหน้าผังโต๊ะ</Link><span className={styles.eyebrow}>MENU CONTROL / MENU_MANAGE</span><h1>จัดการเมนู</h1><p>จัดหมวดหมู่ สินค้า สถานะขาย และรูปภาพสำหรับเมนู QR ลูกค้า</p></div><div className={styles.headerActions}><Link className={styles.secondaryButton} href="/">ผังโต๊ะ</Link></div></header>
    {(error || message) && <div className={error ? styles.error : styles.success}>{error || message}</div>}
    <div className={styles.grid}>
      <section className={styles.panel}><div className={styles.panelTitle}><div><span className={styles.eyebrow}>CATEGORIES</span><h2>หมวดหมู่</h2></div><span>{activeCategories.length} หมวด</span></div>
        <form className={styles.form} onSubmit={saveCategory}><label>ชื่อหมวดหมู่<input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required maxLength={191} /></label><label>คำอธิบาย<input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} maxLength={500} /></label><label>ลำดับ<input type="number" min="0" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })} /></label><div className={styles.formActions}><button className={styles.primaryButton} disabled={busy}>{editingCategory ? "บันทึกหมวดหมู่" : "เพิ่มหมวดหมู่"}</button>{editingCategory && <button type="button" className={styles.linkButton} onClick={() => { setEditingCategory(null); setCategoryForm(blankCategory); }}>ยกเลิก</button>}</div></form>
        <div className={styles.list}>{categories.map((category) => <article className={`${styles.category} ${!category.isActive ? styles.muted : ""}`} key={category.id}><div><strong>{category.name}</strong><small>{category.description || "ไม่มีคำอธิบาย"} · ลำดับ {category.sortOrder}</small></div><div className={styles.rowActions}><button onClick={() => { setEditingCategory(category.id); setCategoryForm({ name: category.name, description: category.description || "", sortOrder: category.sortOrder }); }}>แก้ไข</button>{category.isActive && <button className={styles.dangerButton} onClick={() => void archive(`/api/staff/menu/categories/${category.id}`, "หมวดหมู่")}>ปิดใช้</button>}</div></article>)}</div>
      </section>
      <section className={styles.panel}><div className={styles.panelTitle}><div><span className={styles.eyebrow}>MENU ITEMS</span><h2>สินค้าและรูปภาพ</h2></div><span>{items.filter((item) => item.isActive).length} รายการ</span></div>
        <form className={styles.form} onSubmit={saveItem}><label>หมวดหมู่<select value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })} required><option value="">เลือกหมวดหมู่</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className={styles.twoCol}><label>ชื่อสินค้า<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required maxLength={191} /></label><label>หน่วยเสิร์ฟ<input value={itemForm.servingUnit} onChange={(e) => setItemForm({ ...itemForm, servingUnit: e.target.value })} required maxLength={100} /></label></div><label>คำอธิบาย<input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} maxLength={1000} /></label><label>URL หรือ path รูปภาพ <span className={styles.hint}>เช่น https://… หรือ /images/pork.jpg</span><input value={itemForm.imageKey} onChange={(e) => setItemForm({ ...itemForm, imageKey: e.target.value })} maxLength={500} placeholder="ยังไม่ผูก provider อัปโหลด" /></label>{itemForm.imageKey && <img className={styles.preview} src={itemForm.imageKey} alt="ตัวอย่างรูปสินค้า" onError={(e) => { e.currentTarget.hidden = true; }} />}{editingItem && <label className={styles.checkbox}><input type="checkbox" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} /> เปิดขายผ่าน QR</label>}<div className={styles.formActions}><button className={styles.primaryButton} disabled={busy || !activeCategories.length}>{editingItem ? "บันทึกสินค้า" : "เพิ่มสินค้า"}</button>{editingItem && <button type="button" className={styles.linkButton} onClick={() => { setEditingItem(null); setItemForm(blankItem); }}>ยกเลิก</button>}</div></form>
        <div className={styles.itemList}>{items.map((item) => <article className={`${styles.item} ${!item.isActive ? styles.muted : ""}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" className={styles.thumb} /> : <div className={styles.noImage}>ไม่มีรูป</div>}<div className={styles.itemInfo}><strong>{item.name}</strong><small>{item.category?.name || categories.find((category) => category.id === item.categoryId)?.name || "ไม่ทราบหมวด"} · {item.servingUnit}</small><small>{item.isActive ? (item.isAvailable ? "เปิดขาย" : "พักการขาย") : "ปิดใช้งาน"}</small></div><div className={styles.rowActions}><button onClick={() => { setEditingItem(item.id); setItemForm({ categoryId: item.categoryId, name: item.name, description: item.description || "", servingUnit: item.servingUnit, imageKey: item.imageKey || "", sortOrder: item.sortOrder, isAvailable: item.isAvailable }); }}>แก้ไข</button>{item.isActive && <button className={styles.dangerButton} onClick={() => void archive(`/api/staff/menu/items/${item.id}`, "สินค้า")}>ปิดใช้</button>}</div></article>)}</div>
      </section>
    </div>
  </main>;
}
