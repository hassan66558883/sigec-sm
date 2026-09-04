import { NextResponse } from "next/server";
import { verifyReceiptPublic } from "@/lib/services/receipts";
import { requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";

// Meme budget que /api/verification/[token] — voir audit securite/
// performance 2026-09-02.
const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 20;

// Endpoint PUBLIC (aucune authentification) — section 19 : la verification
// d'un reçu doit fonctionner sans compte utilisateur.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { ipAddress } = requestMeta(req);
  if (isRateLimited(`verify-receipt:${ipAddress ?? "unknown"}`, VERIFY_WINDOW_MS, VERIFY_MAX_ATTEMPTS)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, { status: 429 });
  }
  const { token } = await params;
  const result = await verifyReceiptPublic(token);
  return NextResponse.json(result);
}
