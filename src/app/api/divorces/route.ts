import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listDivorces, declareDivorce } from "@/lib/services/divorces";

export async function GET() {
  try {
    const user = await requirePermission("divorces", "view");
    const data = await listDivorces(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("divorces", "create");
    const body = await req.json();
    const created = await declareDivorce(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
