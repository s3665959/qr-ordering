import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { toErrorResponse } from "@/lib/errors/http-error";
import { OrderStatus } from "@/generated/prisma/client";
import { currentBusinessDay } from "@/lib/time/business-day";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staff = await requireStaff("ORDER_VIEW");
    const searchParams = new URL(request.url).searchParams;
    const requestedStatus = searchParams.get("status");
    const status = requestedStatus && Object.values(OrderStatus).includes(requestedStatus as OrderStatus)
      ? (requestedStatus as OrderStatus)
      : undefined;
    const businessDay = currentBusinessDay();
    const pendingOrders = await prisma.order.findMany({
      where: {
        tableSession: { storeId: staff.storeId },
        status: status ?? { in: ["NEW", "ACCEPTED", "PREPARING", "DELIVERING"] },
      },
      include: { items: true, tableSession: { include: { table: true } } },
      orderBy: { orderedAt: "asc" },
      take: 500,
    });
    const servedWhere = {
      tableSession: { storeId: staff.storeId },
      status: "SERVED" as const,
      servedAt: { gte: businessDay.start, lt: businessDay.end },
    };
    const [servedOrders, servedTotal] = await Promise.all([
      prisma.order.findMany({ where: servedWhere, include: { items: true, tableSession: { include: { table: true } } }, orderBy: { servedAt: "desc" }, take: 10 }),
      prisma.order.count({ where: servedWhere }),
    ]);
    return Response.json({ orders: [...pendingOrders, ...servedOrders], servedTotal, businessDay: businessDay.key }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
