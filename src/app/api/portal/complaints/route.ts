import { NextRequest, NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listMyComplaints, submitComplaint } from "@/lib/services/complaints";

export async function GET() {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const data = await listMyComplaints(account);
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
    const created = await submitComplaint(account, body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
