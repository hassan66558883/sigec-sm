import { NextRequest, NextResponse } from "next/server";
import { processWebhookRetries } from "@/lib/services/integration-webhooks";

// Traite les livraisons de webhook RETRYING dont l'echeance est passee
// (module Integration & Interoperability, section 10). Meme convention que
// cron/relances : appele par un cron systeme externe, protege par
// CRON_SECRET plutot que par une session utilisateur.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas configure." }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const result = await processWebhookRetries();
  return NextResponse.json({ data: result });
}
