import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { commitImport } from "@/lib/services/integration-import";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    if (body.action !== "commit") throw new ApiError(400, "Action inconnue.");
    const result = await commitImport(user, id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
