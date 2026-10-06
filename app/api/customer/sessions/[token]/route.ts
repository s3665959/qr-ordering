import { getCustomerSession } from "@/lib/domain/ordering";
import { toErrorResponse } from "@/lib/errors/http-error";
import { noStoreHeaders } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const result = await getCustomerSession(token);
    return Response.json(result, {
      headers: noStoreHeaders({
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      }),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
