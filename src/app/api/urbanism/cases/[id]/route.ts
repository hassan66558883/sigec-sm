import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { reviewUrbanCase, inspectUrbanCase, decideUrbanCase } from "@/lib/services/urbanism";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    switch (body.action) {
      case "review":
        return NextResponse.json({ data: await reviewUrbanCase(user, id) });
      case "inspect":
        return NextResponse.json({ data: await inspectUrbanCase(user, id, body.notes) });
      case "approve":
        return NextResponse.json({ data: await decideUrbanCase(user, id, true, body.notes) });
      case "reject":
        return NextResponse.json({ data: await decideUrbanCase(user, id, false, body.notes) });
      default:
        throw new ApiError(400, "Action invalide.");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
