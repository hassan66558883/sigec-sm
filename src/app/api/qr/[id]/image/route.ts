import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { inspectQrCode, generateEntityQrPng } from "@/lib/services/qr-codes";

// Image QR imprimable (section 6/7), generee a la volee — encode l'URL
// publique /pay/<token> uniquement, jamais un montant (regle absolue
// section 2). Meme convention que /api/receipts/[id]/qr.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const qr = await inspectQrCode(user, id);
    const baseUrl = process.env.APP_BASE_URL || req.nextUrl.origin;
    const png = await generateEntityQrPng(qr.token, baseUrl);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return handleApiError(error);
  }
}
