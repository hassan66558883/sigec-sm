import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listMobileMoneyTransactions } from "@/lib/services/mobile-money";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("mobile_money", "view");
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const data = await listMobileMoneyTransactions(user, status);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
