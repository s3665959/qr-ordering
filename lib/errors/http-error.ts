export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ConfigurationError) {
    console.error("configuration_error", error.message);
    return Response.json(
      { error: { code: "CONFIGURATION_ERROR", message: "ระบบยังไม่ได้ตั้งค่าความปลอดภัยหรือฐานข้อมูลครบถ้วน" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code?: unknown }).code);
    if (code === "P2002") {
      return Response.json(
        { error: { code: "CONFLICT", message: "ข้อมูลนี้ถูกใช้งานอยู่แล้ว" } },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (code === "P2025") {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลที่ต้องการ" } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  console.error("unhandled_api_error", error instanceof Error ? error.message : "unknown");
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดภายในระบบ" } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
import { ConfigurationError } from "@/lib/config/env";
