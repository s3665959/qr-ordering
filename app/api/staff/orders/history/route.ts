import { requireStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { toErrorResponse, HttpError } from "@/lib/errors/http-error";
import { businessDayBounds, currentBusinessDay } from "@/lib/time/business-day";
import { OrderStatus, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const staff = await requireStaff("ORDER_VIEW");
    const params = new URL(request.url).searchParams;
    const day = params.get("businessDay") ?? currentBusinessDay().key;
    let bounds: { start: Date; end: Date };
    try { bounds = businessDayBounds(day); } catch { throw new HttpError(400, "INVALID_BUSINESS_DAY", "รูปแบบวันทำการไม่ถูกต้อง"); }
    const statusValue = params.get("status");
    if (statusValue && !Object.values(OrderStatus).includes(statusValue as OrderStatus)) throw new HttpError(400, "INVALID_STATUS", "สถานะออเดอร์ไม่ถูกต้อง");
    const tableId = params.get("tableId") || undefined;
    const parsedPage = Number(params.get("page") ?? "1");
    const parsedPageSize = Number(params.get("pageSize") ?? "20");
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize = Number.isInteger(parsedPageSize) && parsedPageSize >= 1 && parsedPageSize <= 50 ? parsedPageSize : 20;
    const tableSession = { storeId: staff.storeId, ...(tableId ? { tableId } : {}) };
    const pendingStatuses: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "DELIVERING"];
    const completionFilter = (field: "servedAt" | "cancelledAt"): Prisma.OrderWhereInput => ({ OR: [{ [field]: { gte: bounds.start, lt: bounds.end } }, { [field]: null }] });
    const where: Prisma.OrderWhereInput = statusValue === "SERVED"
      ? { tableSession, status: "SERVED" as const, ...completionFilter("servedAt") }
      : statusValue === "CANCELLED"
        ? { tableSession, status: "CANCELLED" as const, ...completionFilter("cancelledAt") }
        : statusValue
          ? { tableSession, status: statusValue as OrderStatus, orderedAt: { gte: bounds.start, lt: bounds.end } }
          : { tableSession, OR: [
              { status: "SERVED" as const, ...completionFilter("servedAt") },
              { status: "CANCELLED" as const, ...completionFilter("cancelledAt") },
              { status: { in: pendingStatuses }, orderedAt: { gte: bounds.start, lt: bounds.end } },
            ] };
    const orderBy = statusValue === "SERVED" ? [{ servedAt: "desc" as const }, { id: "desc" as const }]
      : statusValue === "CANCELLED" ? [{ cancelledAt: "desc" as const }, { id: "desc" as const }]
        : [{ orderedAt: "desc" as const }, { id: "desc" as const }];
    const [orders, total, tables] = await Promise.all([
      prisma.order.findMany({ where, include: { items: true, tableSession: { include: { table: true } } }, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.order.count({ where }),
      prisma.diningTable.findMany({ where: { storeId: staff.storeId }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }),
    ]);
    return Response.json({ orders, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), tables, businessDay: day, businessDayStart: bounds.start }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return toErrorResponse(error); }
}
