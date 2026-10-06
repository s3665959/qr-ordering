import { requireStaff } from "@/lib/auth/authorization";
import { extendTableSession } from "@/lib/domain/table-session";
import { extendTableSchema } from "@/lib/validation/api";
import { readJson } from "@/lib/api/request";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("TABLE_EXTEND");
    const { id } = await context.params;
    const parsed = extendTableSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลต่อเวลาไม่ถูกต้อง", parsed.error.flatten());
    const session = await extendTableSession(id, staff.id, staff.storeId, parsed.data.minutes, parsed.data.reason);
    return Response.json({ session }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
