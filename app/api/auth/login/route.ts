import { loginSchema } from "@/lib/validation/api";
import { loginStaff } from "@/lib/auth/login";
import { readJson } from "@/lib/api/request";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง", parsed.error.flatten());
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = forwardedFor || request.headers.get("x-real-ip") || "unknown";
    const staff = await loginStaff(parsed.data.username, parsed.data.password, clientIp);
    return Response.json({ staff }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
