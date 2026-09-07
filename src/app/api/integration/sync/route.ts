import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { createSyncJob } from "@/lib/services/integration-sync";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    const created = await createSyncJob(user, {
      systemId: body.systemId,
      entityType: body.entityType,
      syncType: body.syncType,
      intervalMinutes: body.intervalMinutes ? Number(body.intervalMinutes) : undefined,
      endpointPath: body.endpointPath,
    });
    return NextResponse.json({ data: created });
  } catch (error) {
    return handleApiError(error);
  }
}
