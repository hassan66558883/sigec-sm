import { NextRequest } from "next/server";
import { runGatewayRequest } from "@/lib/integration/gateway";
import { listCitizensForIntegration } from "@/lib/services/integration-v1";

// API publique versionnee (section 7/8) — systeme-a-systeme uniquement,
// authentifiee par cle API via l'API Gateway (jamais par cookie de session).
export async function GET(req: NextRequest) {
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
  return runGatewayRequest(req, "citizens:read", async () => listCitizensForIntegration(page));
}
