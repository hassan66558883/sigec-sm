import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { globalSearch } from "@/lib/services/search";

// Recherche globale (topbar). Pas de requirePermission() global ici :
// globalSearch() applique deja can()/recordScopeWhere() par type
// d'entite, exactement comme les pages de liste existantes.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const data = await globalSearch(user, q);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
