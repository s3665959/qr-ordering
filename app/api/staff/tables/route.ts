import { requireStaff } from "@/lib/auth/authorization";
import { listTables, setTableCount } from "@/lib/domain/table-session";
import { tableCountSchema } from "@/lib/validation/api";
import { readJson } from "@/lib/api/request";
import { HttpError, toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const staff = await requireStaff("TABLE_VIEW");
    const result = await listTables(staff.storeId);
    return Response.json(result, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff("SETTINGS_MANAGE");
    const parsed = tableCountSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "จำนวนโต๊ะต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 200", parsed.error.flatten());
    const result = await setTableCount(staff.storeId, parsed.data.count);
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
