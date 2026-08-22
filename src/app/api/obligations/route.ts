import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listObligations, createObligation } from "@/lib/services/obligations";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("obligations", "view");
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const citizenId = req.nextUrl.searchParams.get("citizenId") ?? undefined;
    const data = await listObligations(user, { status, citizenId });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("obligations", "create");
    const body = await req.json();
    const created = await createObligation(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
