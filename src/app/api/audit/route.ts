import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("audit", "view");
    const moduleFilter = req.nextUrl.searchParams.get("module") ?? undefined;
    const take = Math.min(Number(req.nextUrl.searchParams.get("take") ?? 50), 200);
    const data = await prisma.auditLog.findMany({
      where: moduleFilter ? { module: moduleFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
