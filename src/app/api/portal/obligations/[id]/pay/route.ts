import { NextRequest, NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { initiateOnlinePayment } from "@/lib/services/online-payments";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await initiateOnlinePayment(account, {
      obligationId: id,
      providerCode: body.providerCode || "MANUAL",
      phoneNumber: body.phoneNumber,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
