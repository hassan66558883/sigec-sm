import { NextRequest, NextResponse } from "next/server";
import { getOpenApiSpec } from "@/lib/integration/openapi-spec";

// Documentation publique (section 22) — lire une specification OpenAPI ne
// necessite pas de cle API, seul l'appel effectif aux endpoints en a besoin.
export async function GET(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  return NextResponse.json(getOpenApiSpec(baseUrl));
}
