import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listMarriages, declareMarriage, listMarriageRegimes } from "@/lib/services/marriages";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("marriages", "view");
    if (req.nextUrl.searchParams.get("regimes") === "1") {
      return NextResponse.json({ data: await listMarriageRegimes() });
    }
    const data = await listMarriages(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("marriages", "create");
    const body = await req.json();
    const created = await declareMarriage(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
