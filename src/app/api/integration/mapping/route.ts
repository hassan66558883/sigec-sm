import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { createMapping } from "@/lib/services/integration-mapping";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    const created = await createMapping(user, { name: body.name, entityType: body.entityType, rules: body.rules ?? [] });
    return NextResponse.json({ data: created });
  } catch (error) {
    return handleApiError(error);
  }
}
