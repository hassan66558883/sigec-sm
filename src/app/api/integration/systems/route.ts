import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api";
import { createIntegrationSystem } from "@/lib/services/integration-systems";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("integration", "create");
    const body = await req.json();
    const created = await createIntegrationSystem(user, body);
    return NextResponse.json({ data: created });
  } catch (error) {
    return handleApiError(error);
  }
}
