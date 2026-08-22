import { NextResponse } from "next/server";
import { verifyCertificatePublic } from "@/lib/services/certificates";

// Endpoint PUBLIC (aucune authentification) — section 16 : la verification
// d'un document doit fonctionner sans compte utilisateur.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyCertificatePublic(token);
  return NextResponse.json(result);
}
