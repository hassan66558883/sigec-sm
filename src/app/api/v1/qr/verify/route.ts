import { NextRequest } from "next/server";
import { runGatewayRequest } from "@/lib/integration/gateway";
import { ApiError } from "@/lib/api";
import { verifyCertificatePublic } from "@/lib/services/certificates";

// Variante API Gateway (scopee, journalisee, quotee) de la verification de
// document deja publique sur /verify/{token} et /api/verification/{token}
// (reutilisee ici telle quelle, jamais reimplementee) — destinee a un
// systeme externe authentifie plutot qu'a un simple scan de QR par un
// citoyen, section 8/21.
export async function POST(req: NextRequest) {
  return runGatewayRequest(req, "documents:verify", async () => {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new ApiError(400, "Le champ 'token' est requis.");
    return verifyCertificatePublic(token);
  });
}
