import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError, ApiError } from "@/lib/api";
import { listQuartiers, createQuartier } from "@/lib/services/territorial";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("territorial", "view");
    const arrondissementId = req.nextUrl.searchParams.get("arrondissementId");
    if (!arrondissementId) throw new ApiError(400, "arrondissementId requis.");
    const data = await listQuartiers(user, arrondissementId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("territorial", "create");
    const body = await req.json();
    const created = await createQuartier(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
