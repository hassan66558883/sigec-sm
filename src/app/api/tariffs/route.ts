import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, requirePermission, handleApiError } from "@/lib/api";
import { listTariffs, createOrReviseTariff } from "@/lib/services/tariffs";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const includeHistory = req.nextUrl.searchParams.get("history") === "1";
    const data = await listTariffs(includeHistory);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tariffs", "create");
    const body = await req.json();
    const created = await createOrReviseTariff(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
