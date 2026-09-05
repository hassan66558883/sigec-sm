import { NextRequest, NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { addComplaintCommentAsCitizen } from "@/lib/services/complaints";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();
    const data = await addComplaintCommentAsCitizen(account, id, body.message);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
