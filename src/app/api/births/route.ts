import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listBirthRecords, declareBirth } from "@/lib/services/births";

export async function GET() {
  try {
    const user = await requirePermission("births", "view");
    const data = await listBirthRecords(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("births", "create");
    const body = await req.json();
    const created = await declareBirth(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
