import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { toErrorResponse } from "@/lib/errors/http-error";
import { OrderStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staff = await requireStaff("ORDER_VIEW");
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const status = requestedStatus && Object.values(OrderStatus).includes(requestedStatus as OrderStatus)
      ? (requestedStatus as OrderStatus)
      : undefined;
    const orders = await prisma.order.findMany({
      where: {
        tableSession: { storeId: staff.storeId },
        ...(status ? { status } : {}),
      },
      include: { items: true, tableSession: { include: { table: true } } },
      orderBy: { orderedAt: "asc" },
      take: 200,
    });
    return Response.json({ orders }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
