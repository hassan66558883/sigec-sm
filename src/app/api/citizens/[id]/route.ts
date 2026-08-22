import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { getCitizen } from "@/lib/services/citizens";

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
