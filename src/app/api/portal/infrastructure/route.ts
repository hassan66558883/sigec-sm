import { NextRequest, NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listMyReports, reportIssue } from "@/lib/services/infrastructure";

export async function GET() {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const data = await listMyReports(account);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    const created = await reportIssue(account, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
