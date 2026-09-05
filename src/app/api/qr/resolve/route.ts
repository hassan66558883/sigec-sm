import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { resolveQrForCollection } from "@/lib/services/qr-codes";

// Resolution authentifiee d'un QR pour la collecte terrain (section 21) —
// distinct de /pay/[token] (scan public anonyme) : ici l'agent est
// authentifie et recoit le payeur legal + le detail complet des obligations,
// jamais expose au scan public.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const token = req.nextUrl.searchParams.get("token");
    if (!token) throw new ApiError(400, "token requis.");
    const data = await resolveQrForCollection(user, token);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
