"use client";

import { use, useEffect, useState } from "react";
import QRCode from "qrcode";
import styles from "./page.module.css";

export default function QrPrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [image, setImage] = useState("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  useEffect(() => { const baseUrl = appUrl || window.location.origin; void QRCode.toDataURL(`${baseUrl.replace(/\/$/, "")}/customer/${encodeURIComponent(token)}`, { width: 420, margin: 2, errorCorrectionLevel: "M" }).then(setImage); }, [appUrl, token]);
  const customerUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/customer/${encodeURIComponent(token)}` : "";
  return <main className={styles.page}><section className={styles.card}><span className={styles.eyebrow}>SHABU QR MENU</span><h1>สแกนเพื่อสั่งเนื้อ</h1><p>สแกน QR นี้ด้วยกล้องโทรศัพท์ เพื่อดูเมนูและส่งออเดอร์</p>{image ? <img className={styles.qr} src={image} alt="QR สำหรับสั่งอาหาร" /> : <div className={styles.loading}>กำลังสร้าง QR…</div>}<small className={styles.url}>{customerUrl}</small><button className={styles.printButton} onClick={() => window.print()}>พิมพ์ QR</button></section></main>;
}
