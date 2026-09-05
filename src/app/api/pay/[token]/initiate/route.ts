import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api";
import { initiateQrPayment } from "@/lib/services/qr-payments";
import { isRateLimited } from "@/lib/rate-limit";

// Initiation de paiement depuis un scan QR public (section 9/41) — aucune
// authentification requise. Le CSRF reste verifie normalement (le cookie
// est deja pose des le premier GET de /pay/[token] par proxy.ts) : seule
// l'authentification est absente ici, pas la protection CSRF.
const INITIATE_WINDOW_MS = 5 * 60 * 1000;
const INITIATE_MAX_ATTEMPTS = 10;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    if (isRateLimited(`qr-pay-initiate:${ipAddress}`, INITIATE_WINDOW_MS, INITIATE_MAX_ATTEMPTS)) {
      throw new ApiError(429, "Trop de tentatives. Reessayez dans quelques minutes.");
    }

    const { token } = await params;
    const body = await req.json();
    if (!body.obligationId || !body.providerCode) throw new ApiError(400, "obligationId et providerCode requis.");

    const { payment, redirectUrl } = await initiateQrPayment(token, {
      obligationId: body.obligationId,
      providerCode: body.providerCode,
      phoneNumber: body.phoneNumber,
    });

    return NextResponse.json({ data: { paymentId: payment.id, status: payment.status, redirectUrl } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
