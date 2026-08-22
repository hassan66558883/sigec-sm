import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { issueLandTitle } from "@/lib/services/land";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("land", "issue_title");
    const body = await req.json();
    const created = await issueLandTitle(user, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
