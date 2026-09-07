import { NextRequest, NextResponse } from "next/server";
import { runDueSyncJobs } from "@/lib/services/integration-sync";

// Traite les synchronisations SCHEDULED dont l'echeance est passee
// (module Integration & Interoperability, section 13). Meme convention que
// cron/relances, cron/webhook-retries et cron/health-checks : appele par
// un cron systeme externe, protege par CRON_SECRET.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas configure." }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const result = await runDueSyncJobs();
  return NextResponse.json({ data: result });
}
