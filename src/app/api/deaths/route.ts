import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listDeathRecords, declareDeath } from "@/lib/services/deaths";

export async function GET() {
  try {
    const user = await requirePermission("deaths", "view");
    const data = await listDeathRecords(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("deaths", "create");
    const body = await req.json();
    const created = await declareDeath(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
