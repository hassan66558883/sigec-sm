import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { revokeApiKey, rotateApiKey } from "@/lib/services/integration-api-keys";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();

    if (body.action === "revoke") {
      const updated = await revokeApiKey(user, id);
      return NextResponse.json({ data: updated });
    }
    if (body.action === "rotate") {
      const rotated = await rotateApiKey(user, id);
      return NextResponse.json({ data: rotated });
    }
    throw new ApiError(400, "Action inconnue.");
  } catch (error) {
    return handleApiError(error);
  }
}
