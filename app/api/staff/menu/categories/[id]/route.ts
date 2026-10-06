import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { readJson } from "@/lib/api/request";
import { categoryUpdateSchema } from "@/lib/validation/menu";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const { id } = await context.params;
    const parsed = categoryUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลหมวดหมู่ไม่ถูกต้อง", parsed.error.flatten());
    const existing = await prisma.menuCategory.findFirst({ where: { id, storeId: staff.storeId } });
    if (!existing) throw new HttpError(404, "CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่");
    const category = await prisma.menuCategory.update({ where: { id }, data: parsed.data });
    return Response.json({ category }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const { id } = await context.params;
    const existing = await prisma.menuCategory.findFirst({ where: { id, storeId: staff.storeId } });
    if (!existing) throw new HttpError(404, "CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่");
    const category = await prisma.menuCategory.update({
      where: { id },
      data: { isActive: false, items: { updateMany: { where: { isActive: true }, data: { isActive: false } } } },
    });
    return Response.json({ category }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
