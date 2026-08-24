import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listTechnoLicenses } from "@/lib/services/technotchad";

export async function GET() {
  try {
    const user = await requirePermission("technotchad_licenses", "view");
    const data = await listTechnoLicenses(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
