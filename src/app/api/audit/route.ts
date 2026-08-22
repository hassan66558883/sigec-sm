import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listAuditLogs } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("audit", "view");
    const moduleFilter = req.nextUrl.searchParams.get("module") ?? undefined;
    const take = Math.min(Number(req.nextUrl.searchParams.get("take") ?? 50), 200);
    const data = await listAuditLogs(user, moduleFilter, take);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
