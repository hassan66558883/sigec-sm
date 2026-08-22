import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { getCitizen, updateCitizen } from "@/lib/services/citizens";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("citizens", "view");
    const { id } = await params;
    const data = await getCitizen(user, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("citizens", "edit");
    const { id } = await params;
    const body = await req.json();
    const data = await updateCitizen(user, id, body);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
