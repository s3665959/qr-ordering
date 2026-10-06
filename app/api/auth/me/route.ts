import { getAuthenticatedStaff } from "@/lib/auth/authorization";
import { toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const staff = await getAuthenticatedStaff();
    return Response.json({ staff: staff ? { ...staff, permissions: [...staff.permissions] } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
