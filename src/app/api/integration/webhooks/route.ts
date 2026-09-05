import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { createWebhook } from "@/lib/services/integration-webhooks";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    const created = await createWebhook(user, { url: body.url, event: body.event, systemId: body.systemId || null });
    return NextResponse.json({ data: created });
  } catch (error) {
    return handleApiError(error);
  }
}
