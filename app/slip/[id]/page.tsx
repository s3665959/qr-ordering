import { notFound, redirect } from "next/navigation";
import { getAuthenticatedStaff } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { sessionSlipTimes } from "@/lib/time/session-slip";
import SessionSlip from "../session-slip";

export const dynamic = "force-dynamic";

export default async function PorkSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getAuthenticatedStaff();
  if (!staff) redirect("/login");
  if (!staff.permissions.has("QR_PRINT")) notFound();

  const { id } = await params;
  const session = await prisma.tableSession.findFirst({ where: { id, storeId: staff.storeId }, include: { table: true } });
  if (!session || session.allowsBeefOrderingSnapshot) notFound();

  return <SessionSlip tableName={session.table.tableNumber} adultCount={session.adultCount} childCount={session.childCount} {...sessionSlipTimes(session.openedAt, session.startedAt, session.endsAt)} />;
}
