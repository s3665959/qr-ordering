# สถานะโปรเจกต์ Shabu Buffet

อัปเดตล่าสุด: 2026-10-06

## สถานะเฟส

- [x] เฟส 1: โครง Next.js/TypeScript, Prisma ORM 7.10.0, MySQL schema, migration, seed, Docker Compose และ `.env.example`
- [x] เฟส 2: Prisma client, staff authentication, session cookie, RBAC/permissions, business rules, QR token rotation, idempotency และ Route Handlers หลัก
- [x] เฟส 3: หน้าผังโต๊ะ, หน้าเปิดรอบ/บันทึกชำระเงิน, เริ่มใช้โต๊ะ, ต่อเวลา, ปิดรอบ, timer จาก `serverNow`/`endsAt`, polling 2 วินาที และหน้า login
- [x] เฟส 4: หน้าจัดการหมวดหมู่ สินค้า และรูปภาพ
- [x] เฟส 5: หน้า QR ลูกค้าและ UX การสั่งเนื้อ
- [x] เฟส 6: จอคิวพนักงาน การแจ้งเตือน การพิมพ์ QR และ timer ที่สมบูรณ์
- [x] เฟส 7: ทดสอบ flow จริงตั้งแต่เปิดโต๊ะจนปิดโต๊ะ และแก้ปัญหา

## จุดเริ่มต้นครั้งถัดไป

เริ่มตรวจเฟส 7 โดยใช้โครงสร้างเดิม:

- ทดสอบ flow จริงตั้งแต่เปิดโต๊ะจนปิดโต๊ะ และแก้ปัญหา

เพิ่มในเฟส 6:

- หน้า `/orders` จอคิวออเดอร์แบบ polling และเปลี่ยนสถานะตามลำดับงาน
- แจ้งเตือนออเดอร์ใหม่ด้วย visual alert และเสียงที่ผู้ใช้เปิดเองได้
- หน้า `/qr/:token` สร้าง QR ลูกค้าและสั่งพิมพ์
- ปุ่มพิมพ์/หมุน QR จากผังโต๊ะ

## ผลตรวจเฟส 7

- แก้ปัญหาการเข้าถึง Docker ไม่ต้องเปลี่ยน permission เพิ่ม: ยืนยัน `docker info` ผ่านใน session ปัจจุบัน และ socket ยังคงเป็น `660` ไม่เปิดให้ทุกคนเข้าถึง
- ผู้ใช้ `april` อยู่ในกลุ่ม `docker` ซึ่งเป็นสิทธิ์ระดับสูงกับเครื่อง แต่ session ปัจจุบันเข้าถึง Docker ได้ผ่าน socket ที่มี owner/group `nobody:nogroup`; ไม่มีการใช้ `chmod 666`
- เปิด MySQL 8.4 ด้วย `docker compose up -d mysql` และตรวจ healthcheck ผ่าน โดยไม่ลบหรือ reset volume `shabu-buffet_mysql_data`
- สร้าง `.env` เฉพาะเครื่องเพราะยังไม่มีไฟล์เดิม และไฟล์ถูก ignore ไม่ถูก commit
- รัน `npm run db:migrate:deploy` และ `npm run db:seed` กับ MySQL จริงสำเร็จ
- เพิ่ม `scripts/integration-flow.ts` และคำสั่ง `npm run test:integration` สำหรับ HTTP integration/E2E flow จริง พร้อมข้อมูล fixture แยกต่อการรัน
- ทบทวน `docs/phase2-known-issues.md` แล้ว ไม่พบประเด็นที่จำเป็นต้องเปลี่ยนเพื่อผ่านเฟส 7 จึงไม่เปลี่ยนกติกาหรือ schema เดิม
- ทดสอบครบ: permission rejection, แพ็กเกจหมูไม่มี QR, แพ็กเกจหมู+เนื้อมี QR, pre-start rejection, customer order/จอพนักงาน, status workflow จนเสิร์ฟ, menu CRUD/image key/เปิด-ปิดขาย, idempotency, concurrent requests, หมดเวลา, ออเดอร์เดิมทำต่อหลังหมดเวลา, timer stability และ QR ถูก revoke หลังปิดโต๊ะ
- การทดสอบรูปภาพเป็น image key แบบ path ตาม storage abstraction ปัจจุบัน ยังไม่ใช่การอัปโหลด binary ไปยัง production provider

- static flow checks ครอบคลุม status ของโต๊ะ, ordering window และ image key ผ่านใน `scripts/check-domain.ts`
- `npm run typecheck`, `npm run lint`, `npm run build` และ `npm run db:validate` ผ่าน
- ยังไม่สามารถยืนยัน transaction/integration flow กับ MySQL จริงได้ เพราะ Docker daemon ไม่มีสิทธิ์ใช้งานใน environment นี้
- `npm run test:domain` ผ่านเมื่อรันใน execution profile ที่อนุญาตให้ `tsx` สร้าง named pipe
- `npm run test:integration` ผ่านกับ Next.js และ MySQL จริง

เพิ่มในเฟส 5:

- หน้า `/customer/:token` สำหรับลูกค้าสแกน QR
- แสดงสถานะโต๊ะและเวลาคงเหลือแบบอัปเดตอัตโนมัติ
- เลือกจำนวนเมนูเนื้อและส่งออเดอร์ผ่าน idempotency key
- แสดงออเดอร์ล่าสุดและล็อกการสั่งเมื่อโต๊ะยังไม่เริ่มหรือหมดเวลา

## ผลตรวจล่าสุด

ผ่านแล้ว:

- `npm run typecheck`
- `npm run lint`
- `npm run test:domain`
- `npm run build`
- `npm run db:validate`

เพิ่มในเฟส 4:

- หน้า `/menu` สำหรับจัดการหมวดหมู่และสินค้า โดยใช้ permission `MENU_MANAGE`
- soft delete สำหรับหมวดหมู่/สินค้า เพื่อไม่กระทบออเดอร์เก่า
- image storage boundary ที่รองรับ URL/path และพร้อมเปลี่ยนเป็น provider production

ยังไม่ได้รันกับฐานข้อมูลจริง:

- `prisma migrate deploy`
- `prisma db seed`
- integration tests และ end-to-end tests ที่ใช้ MySQL
- transaction/concurrency tests สำหรับเปิดโต๊ะ หมุน QR และรับออเดอร์

## ผลตรวจชุดสุดท้าย

- `npm run typecheck` ผ่าน
- `npm run lint` ผ่าน โดยมี warning เดิม 4 รายการเรื่องการใช้ `<img>` และไม่มี error
- `npm run test:domain` ผ่าน
- `npm run test:integration` ผ่าน
- `npm run db:validate` ผ่าน
- `npm run build` ผ่าน

## ข้อจำกัดที่ต้องคงไว้

- Docker daemon ยังใช้งานไม่ได้จาก `permission denied`
- ห้ามแก้ permission ของ Docker หรือสิทธิ์ระบบเอง
- ห้ามเปลี่ยน MySQL เป็น SQLite
- ยังไม่มี secret จริงใน repository
- ยังไม่ได้ deploy
- ยังไม่ได้ทดสอบกับเครื่องพิมพ์รุ่นจริง

## เอกสารติดตาม

ข้อสังเกตของเฟส 2 อยู่ที่ `docs/phase2-known-issues.md` และยังไม่ได้เปลี่ยนกติกา/schema ตามรายการดังกล่าว
