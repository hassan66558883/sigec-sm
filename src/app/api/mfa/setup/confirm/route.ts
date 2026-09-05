import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";
import { confirmMfaSetup } from "@/lib/services/mfa";

export async function POST(req: NextRequest) {
  try {
    const { ipAddress } = requestMeta(req);
    if (isRateLimited(`mfa-setup:${ipAddress ?? "unknown"}`)) {
      throw new ApiError(429, "Trop de tentatives. Reessayez dans quelques minutes.");
    }

    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) throw new ApiError(400, "Code requis.");

    const backupCodes = await confirmMfaSetup(user, code);
    return NextResponse.json({ data: { backupCodes } });
  } catch (error) {
    return handleApiError(error);
  }
}
