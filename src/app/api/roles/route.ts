import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listRoles, createRole } from "@/lib/services/roles";

export async function GET() {
  try {
    await requirePermission("roles", "view");
    const data = await listRoles();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("roles", "create");
    const body = await req.json();
    const created = await createRole(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
