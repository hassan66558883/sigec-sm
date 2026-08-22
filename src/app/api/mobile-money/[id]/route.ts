import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { confirmMobileMoneyPayment, failMobileMoneyPayment } from "@/lib/services/mobile-money";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action === "confirm") {
      return NextResponse.json({ data: await confirmMobileMoneyPayment(user, id) });
    }
    if (body.action === "fail") {
      await failMobileMoneyPayment(user, id, body.reason);
      return NextResponse.json({ data: { ok: true } });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
