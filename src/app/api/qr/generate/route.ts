import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { generateQrCode } from "@/lib/services/qr-codes";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    if (!body.entityType || !body.entityId) throw new ApiError(400, "entityType et entityId requis.");
    const data = await generateQrCode(user, body.entityType, body.entityId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
