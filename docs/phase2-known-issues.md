# เฟส 2: ข้อสังเกตที่บันทึกไว้ก่อนเฟส 3

เอกสารนี้เป็นรายการติดตามแยกจากกติกาและ schema ที่อนุมัติแล้ว ไม่ได้เปลี่ยน business rule ในเฟส 3

1. ยังไม่มี MySQL ที่เข้าถึงได้ จึงยังไม่ได้ทดสอบ transaction จริง, concurrent table opening, QR rotation หรือ order idempotency กับฐานข้อมูลจริง
2. การ login ใน schema ปัจจุบันค้นหา username โดยไม่รับ `store_id`; ใช้ได้กับค่าเริ่มต้นหนึ่งสาขา แต่ควรทบทวนก่อนเปิดหลายสาขา
3. เวลารับออเดอร์ใช้ database time แล้ว แต่ timestamp บางรายการ เช่น login และ order status event ยังสร้างจาก application time ควรทำให้เป็น policy เดียวกันก่อน production
4. ยังไม่มี rate limit/lockout สำหรับ login และยังไม่มี endpoint bootstrap บัญชีพนักงานชุดแรก เพราะไม่ควรใส่ password จริงใน seed
5. การ map Prisma unique-conflict เป็น HTTP 409 เป็น fallback ทั่วไป ควรเพิ่ม error mapping เฉพาะ business operation เมื่อมี integration tests

รายการเหล่านี้ไม่ถูกแก้ด้วยการเปลี่ยน lifecycle, QR, permission, idempotency หรือ schema ในเฟส 3
