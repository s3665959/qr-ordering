import { requireStaff } from "@/lib/auth/authorization";
import { rotateQrToken } from "@/lib/domain/table-session";
import { toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("QR_REPRINT");
    const { id } = await context.params;
    const result = await rotateQrToken(id, staff.id, staff.storeId);
    return Response.json({ qrToken: result.token }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
