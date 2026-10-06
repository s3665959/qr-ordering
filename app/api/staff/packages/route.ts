import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { toErrorResponse } from "@/lib/errors/http-error";

export const runtime = "nodejs";

export async function GET() {
  try {
    const staff = await requireStaff("TABLE_OPEN");
    const packages = await prisma.buffetPackage.findMany({
      where: { storeId: staff.storeId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return Response.json({ packages }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
