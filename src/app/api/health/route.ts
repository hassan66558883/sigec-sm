import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Endpoint de supervision (section 32/40 — "monitoring"). Public,
// intentionnellement minimal : ne confirme que la disponibilite de
// l'application et de la base de donnees, sans exposer de detail
// d'infrastructure. A brancher sur un load balancer / outil de supervision
// externe (voir docs/DEPLOYMENT.md).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "error", database: "down", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
