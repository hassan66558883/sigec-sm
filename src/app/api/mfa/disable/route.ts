import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api";
import { requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";
import { disableMfaSelf } from "@/lib/services/mfa";

// Auto-desactivation : exige un code valide (TOTP ou de secours), jamais un
// simple clic — sinon une session deja ouverte (poste partage, ecran
// deverrouille) suffirait a retirer la protection sans reprouver le facteur.
export async function POST(req: NextRequest) {
  try {
    const { ipAddress } = requestMeta(req);
    if (isRateLimited(`mfa-disable:${ipAddress ?? "unknown"}`)) {
      throw new ApiError(429, "Trop de tentatives. Reessayez dans quelques minutes.");
    }

    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) throw new ApiError(400, "Code requis.");

    await disableMfaSelf(user, code);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
