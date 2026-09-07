import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { runSyncJobNow, setSyncJobStatus } from "@/lib/services/integration-sync";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();

    if (body.action === "run_now") {
      const result = await runSyncJobNow(user, id);
      return NextResponse.json({ data: result });
    }
    if (body.action === "set_status") {
      const updated = await setSyncJobStatus(user, id, body.status === "DISABLED" ? "DISABLED" : "ACTIVE");
      return NextResponse.json({ data: updated });
    }
    throw new ApiError(400, "Action inconnue.");
  } catch (error) {
    return handleApiError(error);
  }
}
