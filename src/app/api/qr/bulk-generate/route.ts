import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { bulkGenerateQrStickers } from "@/lib/services/qr-codes";

// Planche PDF de stickers QR (section 38) — traitement synchrone (comme le
// reste de ce projet, aucune file d'attente async) : la reponse EST le PDF,
// pas un identifiant de tache a interroger plus tard.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const body = await req.json();
    if (!body.entityType || !Array.isArray(body.entityIds)) throw new ApiError(400, "entityType et entityIds requis.");

    const pdf = await bulkGenerateQrStickers(user, body.entityType, body.entityIds, req.nextUrl.origin);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-stickers-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
