# Operations and pre-deploy notes

เอกสารนี้เป็นขั้นตอนก่อนเปิดใช้งานจริงเท่านั้น ยังไม่มีคำสั่ง deploy และห้ามใช้ `prisma migrate reset`, SQLite หรือการลบ volume

## Environment และ network

ต้องตั้งค่า `DATABASE_URL`, `AUTH_SESSION_SECRET` และ `QR_TOKEN_PEPPER` จาก secret manager/ไฟล์ที่ permission จำกัด โดย secret ต้องยาวอย่างน้อย 32 ตัวอักษร ห้ามแสดงใน log, shell history หรือ commit

ตั้ง `NEXT_PUBLIC_APP_URL=https://qr-order.811544.xyz` ก่อน `npm run build`; ค่านี้ถูกฝังใน client bundle เพื่อสร้าง QR/lิงก์ลูกค้า ต้องตรวจว่าเป็น HTTPS และไม่มี trailing path ที่ผิด

`IMAGE_STORAGE_DRIVER` ใน source ปัจจุบันรองรับเฉพาะ `local`; image implementation เก็บ URL/path key และยังไม่ใช่ binary upload

Compose ผูก MySQL ที่ `127.0.0.1` โดยค่าเริ่มต้น ใช้ `MYSQL_BIND_ADDRESS` อื่นได้เฉพาะเมื่อเป็น private network ที่มี firewall/ACL และแอปไม่ควรให้ public internet เข้าถึง port 3306

## HTTPS และ headers

วาง Next.js หลัง reverse proxy ที่ terminate HTTPS, redirect HTTP เป็น HTTPS และตั้ง `X-Forwarded-For` จาก proxy ที่เชื่อถือได้เท่านั้น เพราะ login throttle ใช้ username/IP จาก header นี้ แอปตั้ง `HttpOnly`, `SameSite=Lax`, `Secure` ใน production และ security headers ใน `next.config.ts`; ตรวจเพิ่ม HSTS ที่ proxy เมื่อ HTTPS ใช้งานจริงแล้ว

## First OWNER account

After migrations and seed, create the first account interactively:

```bash
npm run staff:create-owner
```

The command does not contain a default username or password. It requires an interactive terminal, hides password input, requires a 12-character minimum password, stores only a bcrypt hash, and assigns the seeded `OWNER` role. Do not pass credentials as command-line arguments or commit them.

## Backup before migration

Take a consistent logical backup before `prisma migrate deploy`. Substitute connection values through a protected environment or secret manager; do not place them in shell history or documents.

```bash
mysqldump --single-transaction --routines --triggers \
  --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" --password \
  "$MYSQL_DATABASE" > shabu-buffet-$(date +%Y%m%d-%H%M%S).sql
```

Check migration status, then apply only forward migrations:

```bash
npm run db:migrate:status
npm run db:migrate:deploy
```

Never use `prisma migrate reset` or remove the MySQL volume for a production operation.

Restore to a deliberately selected database after verifying the backup and maintenance plan:

```bash
mysql --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" --password "$MYSQL_DATABASE" < backup.sql
```

The application currently supports local image paths and external image URLs as `imageKey`; it does not upload binary files. A production storage provider, bucket policy, upload endpoint, file limits, and malware/content validation must be selected before enabling binary uploads.

QR printing uses the browser's `window.print()` dialog. It has not been verified with a physical printer model in this environment.

## Tests

`npm run test:integration` เป็น HTTP integration test ที่เรียก endpoint ผ่าน Next.js และใช้ MySQL จริง; ยังไม่มี browser E2E test ใน repository นี้

## Production checklist

- ยืนยัน `npm run db:migrate:status` และใช้ `npm run db:migrate:deploy` เท่านั้น
- สร้าง OWNER ผ่าน `npm run staff:create-owner` ใน terminal ที่ปลอดภัย แล้วตรวจ login/lockout
- ทดสอบ restore backup ลง database เป้าหมายที่แยกจาก production และกำหนด RPO/RTO, retention, encryption และการตรวจ backup สำเร็จ
- ตรวจ firewall, TLS certificate renewal, log redaction, monitoring/alerting และ process restart กับผู้ดูแลเซิร์ฟเวอร์
