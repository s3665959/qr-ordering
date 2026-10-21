import { notFound, redirect } from "next/navigation";
import { getAuthenticatedStaff } from "@/lib/auth/authorization";
import { hashQrToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { sessionSlipTimes } from "@/lib/time/session-slip";
import SessionSlip from "@/app/slip/session-slip";

export const dynamic = "force-dynamic";

export default async function QrPrintPage({ params }: { params: Promise<{ token: string }> }) {
  const staff = await getAuthenticatedStaff();
  if (!staff) redirect("/login");
  if (!staff.permissions.has("QR_REPRINT")) notFound();

  const { token } = await params;
  const access = await prisma.qrAccessToken.findUnique({
    where: { tokenHash: hashQrToken(token) },
    include: { tableSession: { include: { table: true, activeQrToken: true } } },
  });
  const session = access?.tableSession;
  if (!access || !session || access.revokedAt || access.id !== session.activeQrToken?.qrTokenId || session.storeId !== staff.storeId || !session.allowsBeefOrderingSnapshot) notFound();

  return <SessionSlip tableName={session.table.tableNumber} adultCount={session.adultCount} childCount={session.childCount} {...sessionSlipTimes(session.openedAt, session.startedAt, session.endsAt)} qrToken={token} />;
}
