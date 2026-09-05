import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { retryIntegrationError, resolveIntegrationError, ignoreIntegrationError } from "@/lib/services/integration-errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();

    if (body.action === "retry") {
      const updated = await retryIntegrationError(user, id);
      return NextResponse.json({ data: updated });
    }
    if (body.action === "resolve") {
      const updated = await resolveIntegrationError(user, id);
      return NextResponse.json({ data: updated });
    }
    if (body.action === "ignore") {
      const updated = await ignoreIntegrationError(user, id);
      return NextResponse.json({ data: updated });
    }
    throw new ApiError(400, "Action inconnue.");
  } catch (error) {
    return handleApiError(error);
  }
}
