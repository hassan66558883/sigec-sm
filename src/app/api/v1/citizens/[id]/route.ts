import { NextRequest } from "next/server";
import { runGatewayRequest } from "@/lib/integration/gateway";
import { getCitizenForIntegration } from "@/lib/services/integration-v1";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runGatewayRequest(req, "citizens:read", async () => getCitizenForIntegration(id));
}
