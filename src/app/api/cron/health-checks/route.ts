import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/services/integration-health";

// Verification periodique de sante de tous les systemes connectes (module
// Integration & Interoperability, section 23). Meme convention que
// cron/relances et cron/webhook-retries : appele par un cron systeme
// externe, protege par CRON_SECRET plutot que par une session utilisateur.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas configure." }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const result = await runHealthChecks();
  return NextResponse.json({ data: result });
}
