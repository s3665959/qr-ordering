import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const openTableSchema = z.object({
  tableId: z.string().uuid(),
  packageId: z.string().uuid(),
  guestCount: z.number().int().positive().max(100),
  payment: z.object({
    amount: z.number().finite().nonnegative(),
    method: z.string().trim().min(1).max(50),
    reference: z.string().trim().max(191).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
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
