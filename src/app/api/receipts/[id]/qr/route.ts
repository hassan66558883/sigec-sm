import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { getReceipt, generateReceiptQrPng } from "@/lib/services/receipts";

// Image QR du reçu (section 14/18), generee a la volee — encode l'URL de
// verification publique /verify-receipt/<qrToken>, jamais de donnee
// personnelle dans le QR lui-meme.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Non authentifie.");
    const { id } = await params;
    const receipt = await getReceipt(user, id);
    const baseUrl = process.env.APP_BASE_URL || req.nextUrl.origin;
    const png = await generateReceiptQrPng(receipt.qrToken, baseUrl);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return handleApiError(error);
  }
}
