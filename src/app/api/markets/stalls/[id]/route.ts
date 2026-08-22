import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { setStallStatus } from "@/lib/services/markets";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    const updated = await setStallStatus(user, id, body.status, body.occupantId);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
