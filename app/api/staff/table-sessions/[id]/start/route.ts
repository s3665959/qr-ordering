import { requireStaff } from "@/lib/auth/authorization";
import { startTableSession } from "@/lib/domain/table-session";
import { toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("TABLE_START");
    const { id } = await context.params;
    const session = await startTableSession(id, staff.id, staff.storeId);
    return Response.json({ session }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
