import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { inspectQrCode, revokeQrCode, replaceQrCode, confirmQrInstallation } from "@/lib/services/qr-codes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await inspectQrCode(user, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action === "revoke") {
      return NextResponse.json({ data: await revokeQrCode(user, id, body.reason) });
    }
    if (body.action === "replace") {
      return NextResponse.json({ data: await replaceQrCode(user, id, body.reason) });
    }
    if (body.action === "confirm_install") {
      const gps = typeof body.lat === "number" && typeof body.lng === "number" ? { lat: body.lat, lng: body.lng } : undefined;
      return NextResponse.json({ data: await confirmQrInstallation(user, id, gps) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
