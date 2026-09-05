import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { beginMfaSetup } from "@/lib/services/mfa";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { secret, qrDataUrl } = await beginMfaSetup(user);
    return NextResponse.json({ data: { secret, qrDataUrl } });
  } catch (error) {
    return handleApiError(error);
  }
}
