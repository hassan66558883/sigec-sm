import { NextRequest, NextResponse } from "next/server";
import { runDueReminders } from "@/lib/services/relances";

// Declenche l'echeancier de relance (module paiement en ligne, section 19).
// Destine a etre appele par un cron systeme externe (voir docs/DEPLOYMENT.md),
// jamais par un agent connecte — protege par CRON_SECRET plutot que par une
// session utilisateur. Idempotent (voir services/relances.ts) : un appel
// redondant le meme jour ne renvoie aucune relance en double.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas configure." }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const results = await runDueReminders();
  return NextResponse.json({ data: { count: results.length, results } });
}
