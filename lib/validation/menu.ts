import { z } from "zod";

const optionalText = (max: number) => z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().trim().max(max).optional(),
);

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(191),
  description: optionalText(500),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const menuItemCreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(191),
  description: optionalText(1000),
  servingUnit: z.string().trim().min(1).max(100),
  imageKey: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().trim().max(500).refine((value) => /^(https?:\/\/[^\s]+|\/[A-Za-z0-9][A-Za-z0-9_./-]*)$/.test(value), "รูปภาพต้องเป็น URL หรือ path ใน public เช่น /uploads/menu/pork.jpg").optional(),
  ),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export const menuItemUpdateSchema = menuItemCreateSchema.partial();
