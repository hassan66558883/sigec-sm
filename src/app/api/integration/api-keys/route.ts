import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { createApiKey } from "@/lib/services/integration-api-keys";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const created = await createApiKey(user, { name: body.name, systemId: body.systemId || null, scopes: body.scopes ?? [], expiresAt });
    return NextResponse.json({ data: created });
  } catch (error) {
    return handleApiError(error);
  }
}
