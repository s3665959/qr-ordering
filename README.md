# Shabu Buffet

ระบบจัดการร้านชาบูบุฟเฟต์สำหรับพนักงานและการสั่งเนื้อผ่าน QR ของลูกค้า แอปมี authentication/RBAC, เปิด-เริ่ม-ต่อเวลา-ปิดโต๊ะ, QR ลูกค้า, menu และ order queue แล้ว ใช้ Next.js/TypeScript และ MySQL ผ่าน Prisma ORM 7.10.0

สถานะนี้เป็น pre-deploy preparation: ยังไม่ deploy และต้องตรวจ environment, HTTPS, backup/restore และ migration บนเซิร์ฟเวอร์จริงก่อนเปิดใช้งาน

## Runtime และเริ่มต้นใช้งาน

- Node.js 20.20.2+ และ npm 10+
- MySQL 8.4 ผ่าน Docker Compose หรือ MySQL server ที่เข้าถึงได้
- ไม่รองรับ SQLite

```bash
cp .env.example .env
# แก้ password และสุ่ม secret ใน .env เฉพาะเครื่อง ห้าม commit ไฟล์นี้
npm install
npm run db:generate
docker compose up -d mysql
npm run db:migrate:deploy
npm run db:seed
npm run staff:create-owner
npm run dev
```

`staff:create-owner` ต้องรันใน interactive terminal หลัง migration/seed, รับ password แบบไม่แสดงผล และเก็บเฉพาะ bcrypt hash

## คำสั่งตรวจสอบ

ไม่ต้องใช้ฐานข้อมูล:

```bash
npm run typecheck
npm run lint
npm run test:domain
npm run db:validate
npm run build
```

ต้องใช้ MySQL จริง:

```bash
npm run db:migrate:status
npm run test:integration
```

`test:integration` เป็น HTTP integration test ที่ยิง Route Handlers ผ่านเซิร์ฟเวอร์ Next.js และตรวจข้อมูลใน MySQL จริง ไม่ใช่ browser E2E; repository นี้ยังไม่มี browser E2E suite

สำหรับ integration test ให้ใช้ฐานข้อมูลแยกจาก local/runtime database: copy `.env.test.example` เป็น `.env.test`, ตั้งค่า secrets แล้วรัน `docker compose --env-file .env.test -f docker-compose.test.yml up -d mysql-test`, โดย `DATABASE_URL` และ `TEST_DATABASE_URL` ต้องเหมือนกัน จากนั้นรัน `env $(grep -v '^#' .env.test | xargs) npm run db:migrate:deploy` และ `env $(grep -v '^#' .env.test | xargs) npm run db:seed`. สร้าง build/server ด้วย environment จาก `.env.test`, เปิด server ที่ `http://127.0.0.1:3001` และรัน `npm run test:integration:testdb`; script จะปฏิเสธฐานข้อมูลหรือ `TEST_BASE_URL` ที่ไม่ใช่ local.

## Security และข้อจำกัดที่ต้องรู้

- login มี DB-backed throttle: ผิด 5 ครั้งใน 15 นาทีต่อ username/IP จะ lock 15 นาทีและตอบ 429
- session, login และ order-status timestamps ใช้เวลา MySQL เป็นหลัก; browser timer ใช้ `serverNow` จาก API
- Compose bind MySQL ที่ `127.0.0.1` เป็นค่าเริ่มต้น ห้ามใช้ `MYSQL_BIND_ADDRESS=0.0.0.0` หากไม่มี firewall/private-network policy
- `imageKey` รองรับ local public path หรือ external `https://` URL เท่านั้น ยังไม่มี binary upload, S3/R2 adapter, access policy, file limit หรือ malware validation
- ต้องวางแอปหลัง HTTPS reverse proxy และส่ง security headers ตาม `next.config.ts`; ห้าม expose MySQL สู่ public internet
- ตั้ง `NEXT_PUBLIC_APP_URL=https://qr-order.811544.xyz` ตอน build/deploy เพื่อให้ QR และลิงก์ลูกค้าใช้ public HTTPS URL เดียวกัน
- ดู backup/restore และ forward-only migration ที่ [docs/operations.md](docs/operations.md)

## API หลัก

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `/api/staff/tables`, `/api/staff/table-sessions`, `/api/staff/orders`, `/api/staff/menu`
- `GET /api/customer/sessions/:token` และ `GET/POST /api/customer/sessions/:token/orders`

QR เก็บเฉพาะ token hash/HMAC, response เป็น `no-store`, และไม่ log token แบบ plaintext
