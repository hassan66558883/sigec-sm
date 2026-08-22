import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listFraudAlerts } from "@/lib/services/fraud";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("fraud", "view");
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const severity = req.nextUrl.searchParams.get("severity") ?? undefined;
    const data = await listFraudAlerts(user, { status, severity });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
