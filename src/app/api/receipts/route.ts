import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listReceipts } from "@/lib/services/receipts";

export async function GET() {
  try {
    const user = await requirePermission("receipts", "view");
    const data = await listReceipts(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
