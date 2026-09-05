import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { resolveReconciliationEntry } from "@/lib/services/reconciliation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (typeof body.resolutionNotes !== "string") throw new ApiError(400, "resolutionNotes requis.");
    const data = await resolveReconciliationEntry(user, id, body.resolutionNotes);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
