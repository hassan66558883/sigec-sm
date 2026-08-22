import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listArrondissements, createArrondissement } from "@/lib/services/territorial";

export async function GET() {
  try {
    const user = await requirePermission("territorial", "view");
    const data = await listArrondissements(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("territorial", "create");
    const body = await req.json();
    const created = await createArrondissement(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
