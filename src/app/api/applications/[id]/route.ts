import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { approveApplication, rejectApplication } from "@/lib/services/applications";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action === "approve") {
      return NextResponse.json({ data: await approveApplication(user, id) });
    }
    if (body.action === "reject") {
      return NextResponse.json({ data: await rejectApplication(user, id, body.reason) });
    }
    throw new ApiError(400, "Action invalide.");
  } catch (error) {
    return handleApiError(error);
  }
}
