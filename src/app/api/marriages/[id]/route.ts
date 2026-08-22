import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { validateMarriage } from "@/lib/services/marriages";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action !== "validate") throw new ApiError(400, "Action invalide.");
    return NextResponse.json({ data: await validateMarriage(user, id) });
  } catch (error) {
    return handleApiError(error);
  }
}
