import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listVersements, createVersement } from "@/lib/services/versements";

export async function GET() {
  try {
    const user = await requirePermission("versements", "view");
    const data = await listVersements(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("versements", "create");
    const body = await req.json();
    const created = await createVersement(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
