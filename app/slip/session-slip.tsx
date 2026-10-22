"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import styles from "./session-slip.module.css";

type SlipProps = {
  tableName: string;
  adultCount: number;
  childCount: number;
  date: string;
  startedAt: string;
  endsAt: string;
  qrToken?: string;
};

export default function SessionSlip({ tableName, adultCount, childCount, date, startedAt, endsAt, qrToken }: SlipProps) {
  const [qrImage, setQrImage] = useState("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  useEffect(() => {
    if (!qrToken) return;
    const baseUrl = appUrl || window.location.origin;
    void QRCode.toDataURL(`${baseUrl.replace(/\/$/, "")}/customer/${encodeURIComponent(qrToken)}`, {
      width: 420, margin: 2, errorCorrectionLevel: "M",
    }).then(setQrImage);
  }, [appUrl, qrToken]);

  return <main className={styles.page}>
    <section className={styles.slip} aria-label="ใบพิมพ์รอบโต๊ะ">
      <h1>NIRA SHABU</h1>
      <div className={styles.details}>
        <p>วันที่: {date}</p>
        <p>โต๊ะที่: {tableName}</p>
        <p>เวลาเริ่ม: {startedAt}</p>
        <p>ถึงเวลา: {endsAt}</p>
        <p>ผู้ใหญ่: {adultCount}</p>
        <p>เด็ก: {childCount}</p>
      </div>
      {qrToken && (qrImage ? <img className={styles.qr} src={qrImage} alt="QR สำหรับสั่งอาหาร" /> : <div className={styles.loading}>กำลังสร้าง QR…</div>)}
      <button type="button" className={styles.printButton} disabled={Boolean(qrToken && !qrImage)} onClick={() => window.print()}>พิมพ์ใบโต๊ะ</button>
    </section>
  </main>;
}
