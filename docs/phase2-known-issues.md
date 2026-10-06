# เฟส 2: ผลตรวจจาก source ปัจจุบัน

ผลจากการตรวจ source และ tests ล่าสุด:

1. แก้แล้ว: login มี DB-backed throttle ต่อ username/IP ผิด 5 ครั้งใน 15 นาทีจะ lock 15 นาทีและตอบ 429; integration test ตรวจ flow นี้กับ MySQL จริง
2. แก้แล้ว: login, session expiry และ order-status events ใช้ `CURRENT_TIMESTAMP(3)` จาก MySQL เป็นหลัก
3. แก้แล้วบางส่วน: `P2002` ที่รู้จัก map เป็น `TABLE_ALREADY_IN_USE` หรือ `IDEMPOTENCY_CONFLICT`; constraint ที่ไม่รู้จักยัง fallback เป็น `CONFLICT`
4. แก้แล้ว: compose bind MySQL ที่ `127.0.0.1` เป็นค่าเริ่มต้น
5. จำกัดชัดเจน: image storage ใช้ URL/path key เท่านั้น ยังไม่มี binary upload หรือ S3/R2 implementation

ข้อจำกัดที่ยังเหลือ:

- การตีความ client IP ต้องพึ่ง reverse proxy ที่เชื่อถือได้และตั้งค่า forwarded headers ถูกต้อง
- ยังไม่มี browser E2E; `test:integration` คือ HTTP integration test
- ยังต้องตรวจ migration status, build และ integration บน database/server production-like ก่อน deploy
