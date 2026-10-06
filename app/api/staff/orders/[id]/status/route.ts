import { requireStaff } from "@/lib/auth/authorization";
import { updateOrderStatus } from "@/lib/domain/ordering";
import { readJson } from "@/lib/api/request";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";
import { z } from "zod";

export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "DELIVERING", "SERVED", "CANCELLED"]),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff("ORDER_STATUS_UPDATE");
    const { id } = await context.params;
    const parsed = statusSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลสถานะไม่ถูกต้อง", parsed.error.flatten());
    const order = await updateOrderStatus(id, staff.id, staff.storeId, parsed.data.status, parsed.data.reason);
    return Response.json({ order }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
