# สถานะโปรเจกต์ Shabu Buffet

อัปเดตล่าสุด: 2026-10-06

Deployment precheck: กำหนด `NEXT_PUBLIC_APP_URL=https://qr-order.811544.xyz` ในตัวอย่าง env และ QR client แล้ว แต่ DNS ยังไม่ resolve จาก local และยังตรวจ VPS/Nginx/HTTPS ไม่ได้เพราะ SSH access ถูกปฏิเสธ; ยังไม่มีการแก้ DNS หรือ deploy

## Source และ implementation ที่ตรวจแล้ว

- [x] Next.js/TypeScript, Prisma 7.10.0, MySQL/InnoDB migration และ seed
- [x] Staff authentication, HTTP-only session cookie, RBAC, OWNER bootstrap และ DB-backed login throttle/lockout
- [x] เวลาใน business events ใช้ MySQL `CURRENT_TIMESTAMP(3)` ในจุดสำคัญ
- [x] โต๊ะ, payment, session lifecycle, timer จาก `serverNow`, QR rotation/revocation และ idempotent customer orders
- [x] Menu CRUD และ order queue
- [x] Compose MySQL bind ที่ loopback เป็นค่าเริ่มต้นโดยไม่ลบ volume
- [x] Error mapping สำหรับ unique conflict ที่รู้จัก พร้อม fallback สำหรับ unknown constraint
- [x] Image storage เป็น URL/path key เท่านั้น; ยังไม่มี binary upload หรือ object-storage provider
- [x] `test:integration` เป็น HTTP integration; ยังไม่มี browser E2E
- [x] Public QR URL ใช้ `NEXT_PUBLIC_APP_URL` และบังคับเป็น HTTPS ใน runtime config

## ผลตรวจรอบนี้

ผ่านจาก source/local checks:

- `npm run db:format`
- `npm run db:validate`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint` (ผ่าน มี warning `<img>` 4 รายการ ไม่มี error)

ต้องรันด้วย MySQL จริงและ Next.js server:

- `npm run db:migrate:status`
- `npm run test:domain`
- `npm run test:integration` (รวม login lockout, permission, menu/image key, QR/order/idempotency/concurrency และ lifecycle)
- `npm run build`

ผลคำสั่งที่ต้องพึ่ง server ยังไม่สรุปว่าผ่านจนกว่าจะรันใน environment ที่ผู้ใช้จัดเตรียมให้ได้จริง ห้ามใช้ migrate reset, SQLite หรือ reset volume

## Blockers ก่อน deploy

- ยังไม่ได้ deploy และยังไม่มีการตรวจบน production-like server รอบนี้
- ต้องมี MySQL endpoint/credential ผ่าน secret manager, สิทธิ์ migration, backup/restore plan และ maintenance window
- ต้องมี HTTPS reverse proxy/DNS/certificate, trusted proxy configuration, firewall/ACL และ process/runtime configuration
- ต้องมีการตัดสินใจเรื่อง persistence ของ local image path หากใช้ production; binary upload/S3 ยังเป็นงานที่ไม่มี implementation
- ต้องเลือกและทดสอบ monitoring, log retention/redaction, backup retention, RPO/RTO และการพิมพ์กับ printer จริง
- ต้องตรวจ A/AAAA จาก VPS, reverse proxy, certificate, HTTP→HTTPS redirect, headers และ public API หลังได้ SSH access
