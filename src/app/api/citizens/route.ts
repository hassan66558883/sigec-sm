import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { listCitizens, createCitizen } from "@/lib/services/citizens";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("citizens", "view");
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const data = await listCitizens(user, search);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("citizens", "create");
    const body = await req.json();
    const created = await createCitizen(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
