import { requireStaff } from "@/lib/auth/authorization";
import { listTables } from "@/lib/domain/table-session";
import { toErrorResponse } from "@/lib/errors/http-error";

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
