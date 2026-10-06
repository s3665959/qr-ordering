import { logoutStaff } from "@/lib/auth/login";
import { toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST() {
  try {
    await logoutStaff();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
