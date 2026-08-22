import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { setActivityActive } from "@/lib/services/activities";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    const updated = await setActivityActive(user, id, Boolean(body.isActive));
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
