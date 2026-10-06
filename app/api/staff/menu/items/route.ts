import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { readJson } from "@/lib/api/request";
import { menuItemCreateSchema } from "@/lib/validation/menu";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";
import { withImageUrl } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function GET() {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const items = await prisma.menuItem.findMany({
      where: { category: { storeId: staff.storeId } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: true },
    });
    return Response.json({ items: items.map(withImageUrl) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const parsed = menuItemCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลสินค้าไม่ถูกต้อง", parsed.error.flatten());
    const category = await prisma.menuCategory.findFirst({ where: { id: parsed.data.categoryId, storeId: staff.storeId } });
    if (!category) throw new HttpError(404, "CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่");
    const item = await prisma.menuItem.create({ data: parsed.data });
    return Response.json({ item: withImageUrl(item) }, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
