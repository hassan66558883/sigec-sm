import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { listApplicationsForStaff } from "@/lib/services/applications";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const data = await listApplicationsForStaff(user);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
