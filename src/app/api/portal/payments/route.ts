import { NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listMyPayments } from "@/lib/services/online-payments";

export async function GET() {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const data = await listMyPayments(account);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
