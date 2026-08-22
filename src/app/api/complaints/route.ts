import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listComplaintsForStaff } from "@/lib/services/complaints";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const data = await listComplaintsForStaff(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
