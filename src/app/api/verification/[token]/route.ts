import { NextResponse } from "next/server";
import { verifyCertificatePublic } from "@/lib/services/certificates";
import { requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";

// Budget genereux (un vrai visiteur peut re-scanner/rafraichir plusieurs
// fois) mais non nul : cet endpoint est public/non-authentifie, donc
// auparavant ouvert a l'enumeration de token sans aucune limite (voir audit
// securite/performance 2026-09-02).
const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 20;

// Endpoint PUBLIC (aucune authentification) — section 16 : la verification
// d'un document doit fonctionner sans compte utilisateur.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { ipAddress } = requestMeta(req);
  if (isRateLimited(`verify-cert:${ipAddress ?? "unknown"}`, VERIFY_WINDOW_MS, VERIFY_MAX_ATTEMPTS)) {
    return NextResponse.json({ error: "Trop de tentatives. Reessayez dans quelques minutes." }, { status: 429 });
  }
  const { token } = await params;
  const result = await verifyCertificatePublic(token);
  return NextResponse.json(result);
}
