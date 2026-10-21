import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const openTableSchema = z.object({
  tableId: z.string().uuid(),
  packageId: z.string().uuid(),
  adultCount: z.number().int().min(0).max(100),
  childCount: z.number().int().min(0).max(100),
  guestCount: z.number().int().positive().max(100),
}).refine((value) => value.guestCount === value.adultCount + value.childCount, {
  message: "จำนวนลูกค้ารวมต้องเท่ากับผู้ใหญ่บวกเด็ก",
  path: ["guestCount"],
});

export const tableCountSchema = z.object({
  count: z.number().int().min(1).max(200),
});

export const extendTableSchema = z.object({
  minutes: z.number().int().positive().max(480),
  reason: z.string().trim().min(1).max(500),
});

export const orderSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(100),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(50),
});
