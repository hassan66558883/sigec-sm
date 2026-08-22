import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError, ApiError } from "@/lib/api";
import { listSectors, createSector } from "@/lib/services/territorial";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("territorial", "view");
    const quartierId = req.nextUrl.searchParams.get("quartierId");
    if (!quartierId) throw new ApiError(400, "quartierId requis.");
    const data = await listSectors(user, quartierId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("territorial", "create");
    const body = await req.json();
    const created = await createSector(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
