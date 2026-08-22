import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listUrbanCases, submitUrbanCase } from "@/lib/services/urbanism";

export async function GET() {
  try {
    const user = await requirePermission("urbanism", "view");
    const data = await listUrbanCases(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("urbanism", "create");
    const body = await req.json();
    const created = await submitUrbanCase(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
