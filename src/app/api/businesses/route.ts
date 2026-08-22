import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listBusinesses, createBusiness } from "@/lib/services/businesses";

export async function GET() {
  try {
    const user = await requirePermission("businesses", "view");
    const data = await listBusinesses(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("businesses", "create");
    const body = await req.json();
    const created = await createBusiness(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
