import { requireStaff } from "@/lib/auth/authorization";
import { openTableSession } from "@/lib/domain/table-session";
import { openTableSchema } from "@/lib/validation/api";
import { readJson } from "@/lib/api/request";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const staff = await requireStaff("TABLE_OPEN");
    const parsed = openTableSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลเปิดโต๊ะไม่ถูกต้อง", parsed.error.flatten());
    const result = await openTableSession({ ...parsed.data, storeId: staff.storeId, staffId: staff.id });
    return Response.json(
      { session: result.session, qrToken: result.qrToken ?? null },
      { status: 201, headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
