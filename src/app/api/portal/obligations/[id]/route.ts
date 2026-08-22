import { NextResponse } from "next/server";
import { getCurrentCitizenAccount } from "@/lib/citizen-auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getMyObligation } from "@/lib/services/online-payments";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getCurrentCitizenAccount();
    if (!account) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await getMyObligation(account, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
