import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint de supervision (section 32/40 — "monitoring"). Public,
// intentionnellement minimal : ne confirme que la disponibilite de
// l'application et de la base de donnees, sans exposer de detail
// d'infrastructure (pas de version, pas de nom d'hote, pas de trace
// d'erreur). A brancher sur un load balancer / outil de supervision externe
// (voir docs/DEPLOYMENT.md).
//
// "degraded" (toujours HTTP 200 — l'appli repond, ne pas declencher de
// failover) signale une latence base anormale, avant qu'elle ne devienne une
// vraie panne ; seul un "error" (base injoignable) renvoie 503.
const DEGRADED_LATENCY_MS = 500;

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.round(process.uptime());

  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - startedAt);
    const status = latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "ok";
    return NextResponse.json({ status, database: { up: true, latencyMs }, uptimeSeconds, timestamp });
  } catch {
    return NextResponse.json(
      { status: "error", database: { up: false }, uptimeSeconds, timestamp },
      { status: 503 },
    );
  }
}
