import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { setWebhookStatus, deleteWebhook, testWebhook } from "@/lib/services/integration-webhooks";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();

    if (body.action === "test") {
      const delivery = await testWebhook(user, id);
      return NextResponse.json({ data: delivery });
    }
    if (body.action === "set_status") {
      const updated = await setWebhookStatus(user, id, body.status === "DISABLED" ? "DISABLED" : "ACTIVE");
      return NextResponse.json({ data: updated });
    }
    throw new ApiError(400, "Action inconnue.");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    await deleteWebhook(user, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
