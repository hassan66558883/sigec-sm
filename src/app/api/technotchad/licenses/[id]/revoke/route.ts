import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { revokeTechnoLicense } from "@/lib/services/technotchad";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("technotchad_licenses", "revoke");
    const { id } = await params;
    const updated = await revokeTechnoLicense(user, id);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
