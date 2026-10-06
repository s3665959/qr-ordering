export const orderStatusLabels = {
  NEW: "รอรับออเดอร์",
  ACCEPTED: "รับออเดอร์แล้ว",
  PREPARING: "กำลังเตรียม",
  DELIVERING: "กำลังนำมาเสิร์ฟ",
  SERVED: "เสิร์ฟแล้ว",
  CANCELLED: "ยกเลิก",
} as const;

export const orderQueueStatuses = ["NEW", "ACCEPTED", "PREPARING", "DELIVERING", "SERVED"] as const;

export const nextOrderStatus: Record<string, string | undefined> = {
  NEW: "ACCEPTED",
  ACCEPTED: "SERVED",
  PREPARING: "SERVED",
  DELIVERING: "SERVED",
};

export const orderActionLabels: Record<string, string> = {
  ACCEPTED: "รับออเดอร์",
  SERVED: "เสิร์ฟแล้ว",
};

export const cancellableOrderStatuses = ["NEW", "ACCEPTED", "PREPARING", "DELIVERING"] as const;

export const allowedOrderTransitions: Record<string, readonly string[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["SERVED", "CANCELLED"],
  // These are retained only so existing orders can be completed safely.
  PREPARING: ["SERVED", "CANCELLED"],
  DELIVERING: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

export function canTransitionOrderStatus(fromStatus: string, toStatus: string): boolean {
  return allowedOrderTransitions[fromStatus]?.includes(toStatus) ?? false;
}
