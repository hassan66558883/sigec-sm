import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listCollectors, createCollector } from "@/lib/services/collectors";

export async function GET() {
  try {
    const user = await requirePermission("collectors", "view");
    const data = await listCollectors(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("collectors", "create");
    const body = await req.json();
    const created = await createCollector(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
