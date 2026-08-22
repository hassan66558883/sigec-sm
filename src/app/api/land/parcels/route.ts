import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listParcels, createParcel } from "@/lib/services/land";

export async function GET() {
  try {
    const user = await requirePermission("land", "view");
    const data = await listParcels(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("land", "create");
    const body = await req.json();
    const created = await createParcel(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
