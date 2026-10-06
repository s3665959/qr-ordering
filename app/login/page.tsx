"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return <main className={styles.page}><form className={styles.card} onSubmit={submit}><span className={styles.eyebrow}>SHABU CONTROL</span><h1>เข้าสู่ระบบพนักงาน</h1><p>ใช้บัญชีพนักงานที่ผู้จัดการสร้างไว้เพื่อเปิดและปิดรอบโต๊ะ</p><label>ชื่อผู้ใช้<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>รหัสผ่าน<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className={styles.error}>{error}</div>}<button disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button></form></main>;
}
