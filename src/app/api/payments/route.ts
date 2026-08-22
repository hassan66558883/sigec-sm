import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listPayments, recordPayment } from "@/lib/services/payments";

export async function GET() {
  try {
    const user = await requirePermission("payments", "view");
    const data = await listPayments(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("payments", "create");
    const body = await req.json();
    const created = await recordPayment(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
