import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { updateInfrastructureStatus } from "@/lib/services/infrastructure";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    return NextResponse.json({ data: await updateInfrastructureStatus(user, id, body.status) });
  } catch (error) {
    return handleApiError(error);
  }
}
