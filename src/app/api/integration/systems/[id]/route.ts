import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import {
  updateIntegrationSystem,
  setIntegrationSystemEnabled,
  testIntegrationSystemConnection,
} from "@/lib/services/integration-systems";

// Chaque action requiert une permission differente (test vs update) —
// verifiee individuellement DANS chaque fonction de service, pas ici, pour
// qu'un utilisateur n'ayant que integration:test puisse tester une connexion
// sans avoir besoin de integration:update.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const body = await req.json();

    if (body.action === "test_connection") {
      const result = await testIntegrationSystemConnection(user, id);
      return NextResponse.json({ data: result });
    }
    if (body.action === "set_enabled") {
      const updated = await setIntegrationSystemEnabled(user, id, Boolean(body.enabled));
      return NextResponse.json({ data: updated });
    }
    if (body.action) throw new ApiError(400, "Action inconnue.");

    const updated = await updateIntegrationSystem(user, id, body);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
