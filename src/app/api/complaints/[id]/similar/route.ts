import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { findSimilarComplaints } from "@/lib/services/complaints";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const data = await findSimilarComplaints(user, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
