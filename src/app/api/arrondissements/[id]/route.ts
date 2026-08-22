import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { setArrondissementActive } from "@/lib/services/territorial";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("territorial", "edit");
    const { id } = await params;
    const body = await req.json();
    const updated = await setArrondissementActive(user, id, Boolean(body.isActive));
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
