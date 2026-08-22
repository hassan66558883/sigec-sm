import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { getFinanceSummary } from "@/lib/services/payments";

export async function GET() {
  try {
    const user = await requirePermission("payments", "view");
    const data = await getFinanceSummary(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
