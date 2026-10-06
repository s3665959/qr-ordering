# Shabu Buffet

ระบบจัดการร้านชาบูบุฟเฟต์สำหรับพนักงานและการสั่งเนื้อผ่าน QR ของลูกค้า

เฟส 1 นี้เตรียมโครง Next.js/TypeScript, Prisma ORM 7.10.0, schema MySQL/InnoDB, migration แรก, seed พื้นฐาน, Docker Compose สำหรับ MySQL และ abstraction ของที่เก็บรูปภาพไว้ในโครงสร้างโปรเจกต์แล้ว ยังไม่มีฟีเจอร์หน้าร้านหรือ API business logic ในเฟสนี้

## ข้อกำหนด runtime

- Node.js 20.20.2 หรือใหม่กว่าในสายที่ Prisma 7 รองรับ
- npm 10+
- MySQL 8.4 ผ่าน Docker Compose หรือ MySQL server ที่เข้าถึงได้
- ไม่รองรับการเปลี่ยน datasource เป็น SQLite

## เริ่มต้นใช้งาน

```bash
cp .env.example .env
# แก้ค่ารหัสผ่านและ secret ใน .env ให้เป็นค่าที่สร้างขึ้นสำหรับเครื่องนี้

npm install
npm run db:generate
```

เมื่อ Docker daemon หรือ MySQL server ใช้งานได้แล้ว:

```bash
docker compose up -d mysql
npm run db:migrate:deploy
npm run db:seed
npm run staff:create-owner
```

`staff:create-owner` prompts for the first OWNER username and password without storing a default credential. Run it from an interactive terminal after seed.

รันแอปใน development:

```bash
npm run dev
```

## การตรวจสอบเฟส 1

คำสั่งที่ไม่ต้องเชื่อมต่อฐานข้อมูล:

```bash
npm run db:format
DATABASE_URL='mysql://placeholder:placeholder@127.0.0.1:3306/shabu_buffet' npm run db:validate
DATABASE_URL='mysql://placeholder:placeholder@127.0.0.1:3306/shabu_buffet' npm run db:generate
npm run typecheck
npm run lint
npm run build
```

คำสั่งต่อไปนี้ต้องใช้ MySQL ที่เชื่อมต่อได้จริง:

```bash
npm run db:migrate:status
npm run db:migrate:deploy
npm run db:seed
```

หาก Docker แสดง `permission denied` จะไม่แก้ permission หรือเปลี่ยนฐานข้อมูลทดแทน การตรวจที่ต้องใช้ MySQL จะถูกระบุว่ายังไม่ได้รันจนกว่าจะมี Docker daemon หรือ MySQL server ที่ผู้ใช้จัดเตรียมและเข้าถึงได้

## กติกาข้อมูลสำคัญ

- หนึ่งโต๊ะมี active table session ได้ไม่เกินหนึ่งรายการ โดยใช้ `active_table_sessions`
- หนึ่ง table session มี active QR token ได้ไม่เกินหนึ่งรายการ โดยใช้ `active_qr_tokens`
- การพิมพ์ QR ซ้ำต้อง revoke token เดิม ออก token ใหม่ และบันทึก event ใน transaction เดียวกัน
- เก็บเฉพาะ token hash/HMAC ในฐานข้อมูล ไม่เก็บ token จริงหรือส่ง token ไป third-party analytics
- `TIME_EXPIRED` และ `ENDING_SOON` เป็น effective status ที่คำนวณจาก `ends_at`; lifecycle ใน MySQL ยังคงเป็น `ACTIVE` จนกว่าจะต่อเวลาหรือปิดรอบ
- QR ที่ออกหลังชำระเงินแต่ก่อนกดเริ่มโต๊ะเปิดหน้าได้ แต่ Backend ยังไม่รับออเดอร์
- `MENU_MANAGE` ครอบคลุมหมวดหมู่ สินค้า ชื่อสินค้า รูปภาพ และสถานะขาย

## API ที่มีในเฟส 2

พนักงานใช้ session cookie แบบ HTTP-only และทุก endpoint ตรวจ permission ที่ Backend:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/staff/tables`
- `POST /api/staff/table-sessions`
- `POST /api/staff/table-sessions/:id/start`
- `POST /api/staff/table-sessions/:id/extend`
- `POST /api/staff/table-sessions/:id/close`
- `POST /api/staff/table-sessions/:id/qr` สำหรับพิมพ์ QR ซ้ำและหมุน token
- `GET /api/staff/orders`, `POST /api/staff/orders/:id/status`
- `GET/POST /api/staff/menu/categories`, `PATCH /api/staff/menu/categories/:id`
- `GET/POST /api/staff/menu/items`, `PATCH /api/staff/menu/items/:id`
- `GET /api/customer/sessions/:token`
- `GET/POST /api/customer/sessions/:token/orders`

ทุก response ที่เกี่ยวข้องกับ QR ใช้ `no-store`, `Referrer-Policy: no-referrer` และไม่มี logging token แบบ plaintext

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
