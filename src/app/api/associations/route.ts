import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listAssociations, createAssociation } from "@/lib/services/associations";

export async function GET() {
  try {
    const user = await requirePermission("associations", "view");
    const data = await listAssociations(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("associations", "create");
    const body = await req.json();
    const created = await createAssociation(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
