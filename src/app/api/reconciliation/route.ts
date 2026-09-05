import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { ingestReconciliationStatement } from "@/lib/services/reconciliation";

// Televersement d'un releve prestataire/banque (module paiement QR, section
// 31). Le fichier est lu en memoire (texte CSV) et jamais stocke tel quel —
// seul son nom est conserve pour tracabilite ; ce qui compte est le lot de
// rapprochement qu'il produit, pas l'archivage du fichier source.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Fichier requis.");
    const provider = formData.get("provider");
    const periodStart = formData.get("periodStart");
    const periodEnd = formData.get("periodEnd");
    if (typeof provider !== "string" || typeof periodStart !== "string" || typeof periodEnd !== "string") {
      throw new ApiError(400, "provider, periodStart et periodEnd requis.");
    }

    const csvText = await file.text();
    const data = await ingestReconciliationStatement(user, { provider, periodStart, periodEnd, fileName: file.name, csvText });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
