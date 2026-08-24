import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listTechnoPlans } from "@/lib/services/technotchad";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("technotchad_plans", "view");
    const productId = req.nextUrl.searchParams.get("productId") ?? undefined;
    const data = await listTechnoPlans(user, productId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
