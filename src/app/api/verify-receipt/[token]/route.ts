import { NextResponse } from "next/server";
import { verifyReceiptPublic } from "@/lib/services/receipts";

// Endpoint PUBLIC (aucune authentification) — section 19 : la verification
// d'un reçu doit fonctionner sans compte utilisateur.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await verifyReceiptPublic(token);
  return NextResponse.json(result);
}
