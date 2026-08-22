import { NextRequest, NextResponse } from "next/server";
import { handlePaymentCallback } from "@/lib/services/online-payments";

// Webhook prestataire (module paiement en ligne, section 9/11) — endpoint
// PUBLIC, non authentifie par session (un vrai prestataire n'a pas de
// cookie SIGEC-SM) : la confiance vient de la verification/signature geree
// par PaymentProvider.handleCallback()/verifyTransaction(), jamais de la
// simple reception de la requete. Repond TOUJOURS 200 (meme en cas d'echec
// applicatif) pour eviter qu'un prestataire ne re-livre indefiniment un
// webhook que nous avons deja traite ou rejete deliberement.
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => (headers[key] = value));

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "Corps JSON invalide." }, { status: 200 });
  }

  try {
    const result = await handlePaymentCallback(provider, payload, headers);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[payments/callback/${provider}] erreur:`, error);
    return NextResponse.json({ ok: false, reason: "Erreur interne." }, { status: 200 });
  }
}
