import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { readJson } from "@/lib/api/request";
import { categoryCreateSchema } from "@/lib/validation/menu";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const categories = await prisma.menuCategory.findMany({
      where: { storeId: staff.storeId },
      orderBy: { sortOrder: "asc" },
      include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    });
    return Response.json({ categories }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff("MENU_MANAGE");
    const parsed = categoryCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลหมวดหมู่ไม่ถูกต้อง", parsed.error.flatten());
    const category = await prisma.menuCategory.create({ data: { ...parsed.data, storeId: staff.storeId } });
    return Response.json({ category }, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
