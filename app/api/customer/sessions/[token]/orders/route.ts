import { getCustomerSession, createCustomerOrder } from "@/lib/domain/ordering";
import { orderSchema } from "@/lib/validation/api";
import { readJson, noStoreHeaders } from "@/lib/api/request";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const result = await getCustomerSession(token);
    return Response.json({ session: result.session, orders: result.orders }, { headers: noStoreHeaders({ "Referrer-Policy": "no-referrer" }) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const parsed = orderSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลออเดอร์ไม่ถูกต้อง", parsed.error.flatten());
    const order = await createCustomerOrder(token, parsed.data);
    return Response.json({ order }, { status: 201, headers: noStoreHeaders({ "Referrer-Policy": "no-referrer" }) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
