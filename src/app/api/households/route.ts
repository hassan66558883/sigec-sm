import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listHouseholds, createHousehold } from "@/lib/services/households";

export async function GET() {
  try {
    const user = await requirePermission("households", "view");
    const data = await listHouseholds(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("households", "create");
    const body = await req.json();
    const created = await createHousehold(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
