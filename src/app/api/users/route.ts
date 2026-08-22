import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listUsers, createUser } from "@/lib/services/users";

export async function GET() {
  try {
    const user = await requirePermission("users", "view");
    const data = await listUsers(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("users", "create");
    const body = await req.json();
    const created = await createUser(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
