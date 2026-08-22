import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listDepartments, createDepartment } from "@/lib/services/departments";

export async function GET() {
  try {
    await requirePermission("departments", "view");
    const data = await listDepartments();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("departments", "create");
    const body = await req.json();
    const created = await createDepartment(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
