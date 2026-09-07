import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptField } from "@/lib/encryption";
import { issueAccessToken } from "@/lib/integration/oauth";
import { logAudit, requestMeta } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";

// Jeton d'acces OAuth2, grant_type=client_credentials (RFC 6749 section
// 4.4 — machine-a-machine, aucune redirection utilisateur). Accepte le
// type de corps standard (application/x-www-form-urlencoded) ET JSON par
// commodite ; reponses au format RFC6749 (access_token/token_type/
// expires_in/scope, ou {error} sur echec) pour rester interoperable avec
// un client OAuth2 generique plutot qu'une forme SIGEC-SM specifique.
function oauthError(status: number, error: string, description?: string) {
  return NextResponse.json({ error, error_description: description }, { status });
}

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(req: NextRequest) {
  const { ipAddress } = requestMeta(req);
  if (isRateLimited(`oauth-token:${ipAddress ?? "unknown"}`)) {
    return oauthError(429, "temporarily_unavailable", "Trop de tentatives. Reessayez dans quelques minutes.");
  }

  const body = await parseBody(req);
  if (body.grant_type !== "client_credentials") {
    return oauthError(400, "unsupported_grant_type", "Seul grant_type=client_credentials est pris en charge.");
  }
  if (!body.client_id || !body.client_secret) {
    return oauthError(400, "invalid_request", "client_id et client_secret sont requis.");
  }

  const credential = await prisma.integrationCredential.findFirst({
    where: { clientId: body.client_id },
    include: { system: true },
  });

  const secretOk = credential?.clientSecret ? decryptField(credential.clientSecret) === body.client_secret : false;

  if (!credential || !secretOk) {
    await logAudit({ user: null, action: "OAUTH_TOKEN_DENIED", module: "integration", ipAddress, newValue: { clientId: body.client_id, reason: "invalid_client" } });
    return oauthError(401, "invalid_client", "client_id ou client_secret invalide.");
  }
  if (!credential.system.enabled || credential.system.status === "DISABLED") {
    await logAudit({ user: null, action: "OAUTH_TOKEN_DENIED", module: "integration", ipAddress, newValue: { clientId: body.client_id, reason: "system_disabled" } });
    return oauthError(401, "invalid_client", "Systeme externe desactive.");
  }

  // scope demande = sous-ensemble des scopes accordes a ce client ; sans
  // parametre scope, le jeton recoit tous les scopes configures (meme
  // convention que la plupart des serveurs OAuth2).
  const requestedScopes = body.scope ? body.scope.split(" ").filter(Boolean) : credential.scopes;
  const grantedScopes = requestedScopes.filter((s) => credential.scopes.includes(s));
  if (body.scope && grantedScopes.length !== requestedScopes.length) {
    return oauthError(400, "invalid_scope", "Un ou plusieurs scopes demandes ne sont pas accordes a ce client.");
  }

  const { token, expiresIn } = await issueAccessToken({ sub: credential.systemId, client_id: credential.clientId!, scope: grantedScopes.join(" ") });

  await logAudit({ user: null, action: "OAUTH_TOKEN_ISSUED", module: "integration", entityType: "IntegrationSystem", entityId: credential.systemId, ipAddress, newValue: { clientId: body.client_id, scope: grantedScopes.join(" ") } });

  return NextResponse.json({ access_token: token, token_type: "Bearer", expires_in: expiresIn, scope: grantedScopes.join(" ") });
}
