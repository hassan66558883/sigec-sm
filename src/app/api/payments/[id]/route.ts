import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { cancelPayment } from "@/lib/services/payments";
import { refundPayment } from "@/lib/services/refunds";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action === "cancel") {
      return NextResponse.json({ data: await cancelPayment(user, id, body.reason) });
    }
    if (body.action === "refund") {
      return NextResponse.json({ data: await refundPayment(user, id, body.reason, body.amount) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
