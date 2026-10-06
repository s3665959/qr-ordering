import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { readJson } from "@/lib/api/request";
import { menuItemUpdateSchema } from "@/lib/validation/menu";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";
import { withImageUrl } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const { id } = await context.params;
    const parsed = menuItemUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลสินค้าไม่ถูกต้อง", parsed.error.flatten());
    const existing = await prisma.menuItem.findFirst({ where: { id, category: { storeId: staff.storeId } } });
    if (!existing) throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "ไม่พบสินค้า");
    if (parsed.data.categoryId) {
      const category = await prisma.menuCategory.findFirst({ where: { id: parsed.data.categoryId, storeId: staff.storeId } });
      if (!category) throw new HttpError(404, "CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่");
    }
    const item = await prisma.menuItem.update({ where: { id }, data: parsed.data });
    return Response.json({ item: withImageUrl(item) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const { id } = await context.params;
    const existing = await prisma.menuItem.findFirst({ where: { id, category: { storeId: staff.storeId } } });
    if (!existing) throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "ไม่พบสินค้า");
    const item = await prisma.menuItem.update({ where: { id }, data: { isActive: false, isAvailable: false } });
    return Response.json({ item: withImageUrl(item) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
