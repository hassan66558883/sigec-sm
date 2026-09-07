import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api";
import { verifyAccessToken, looksLikeJwt } from "@/lib/integration/oauth";
import { buildSoapFault } from "@/lib/integration/soap";

// API Gateway (Integration & Interoperability Center, section 2/6/38) —
// point d'entree UNIQUE pour tout systeme externe. Aucune route /api/v1/*
// n'accede a Prisma sans etre passee par runGatewayRequest() ci-dessous :
// authentification (cle API OU jeton OAuth2, voir authenticate() plus
// bas), verification de scope, quota par systeme, et journalisation de
// CHAQUE appel (succes ou echec) dans IntegrationLog, avec un
// IntegrationError cree pour tout rejet (auth/scope/quota).
//
// Distinct de l'authentification par cookie de session (lib/auth.ts) :
// un systeme externe n'a jamais de session navigateur, uniquement une cle
// API ou un jeton OAuth2 dans l'en-tete Authorization.

const KEY_RAW_BYTES = 24; // 48 caracteres hex apres le prefixe
const KEY_PREFIX_LENGTH = 12; // "sigk_" + 7 caracteres hex — non secret, sert uniquement a la recherche indexee AVANT le bcrypt.compare (un hash bcrypt ne permet aucune recherche directe par egalite)

export function generateApiKeyMaterial(): { raw: string; keyPrefix: string } {
  const raw = `sigk_${randomBytes(KEY_RAW_BYTES).toString("hex")}`;
  return { raw, keyPrefix: raw.slice(0, KEY_PREFIX_LENGTH) };
}

export async function hashApiKey(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}

function generateCorrelationId(): string {
  const now = new Date();
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `SIGEC-${ymd}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function extractRawToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const headerKey = req.headers.get("x-api-key");
  return headerKey?.trim() || null;
}

export type GatewayContext = {
  apiKeyId: string | null; // null pour un appel authentifie par jeton OAuth2 (pas de ligne IntegrationApiKey)
  systemId: string | null;
  scopes: string[];
  correlationId: string;
  requestId: string;
};

type AuthResult =
  | { ok: true; apiKeyId: string | null; systemId: string | null; scopes: string[] }
  | { ok: false; status: number; errorType: string; message: string; systemId: string | null };

// Authentifie soit une cle API (prefixe "sigk_", bcrypt), soit un jeton
// OAuth2 (JWT signe par /api/v1/oauth/token) — deux mecanismes distincts
// convergeant vers la meme forme {systemId, scopes} pour le reste du
// pipeline (verification de scope/quota/journalisation), qui ne connait
// ensuite plus la difference entre les deux.
async function authenticate(rawToken: string | null): Promise<AuthResult> {
  if (!rawToken) {
    return { ok: false, status: 401, errorType: "GATEWAY_AUTH_MISSING", message: "Authentification requise (cle API ou jeton OAuth2).", systemId: null };
  }

  if (looksLikeJwt(rawToken)) {
    const verified = await verifyAccessToken(rawToken);
    if (!verified) {
      return { ok: false, status: 401, errorType: "GATEWAY_AUTH_INVALID", message: "Jeton OAuth2 invalide ou expire.", systemId: null };
    }
    const system = await prisma.integrationSystem.findUnique({ where: { id: verified.systemId } });
    if (!system || !system.enabled || system.status === "DISABLED") {
      return { ok: false, status: 401, errorType: "GATEWAY_SYSTEM_DISABLED", message: "Systeme externe desactive.", systemId: verified.systemId };
    }
    return { ok: true, apiKeyId: null, systemId: verified.systemId, scopes: verified.scopes };
  }

  if (!rawToken.startsWith("sigk_")) {
    return { ok: false, status: 401, errorType: "GATEWAY_AUTH_MISSING", message: "Cle API mal formee.", systemId: null };
  }

  const keyPrefix = rawToken.slice(0, KEY_PREFIX_LENGTH);
  const candidate = await prisma.integrationApiKey.findUnique({ where: { keyPrefix }, include: { system: true } });
  const valid = candidate && (await bcrypt.compare(rawToken, candidate.keyHash));
  if (!valid) {
    return { ok: false, status: 401, errorType: "GATEWAY_AUTH_INVALID", message: "Cle API invalide.", systemId: candidate?.systemId ?? null };
  }
  if (candidate.status !== "ACTIVE" || (candidate.expiresAt && candidate.expiresAt < new Date())) {
    return { ok: false, status: 401, errorType: "GATEWAY_AUTH_INACTIVE", message: `Cle API ${candidate.status === "ACTIVE" ? "expiree" : candidate.status.toLowerCase()}.`, systemId: candidate.systemId };
  }
  if (candidate.system && (!candidate.system.enabled || candidate.system.status === "DISABLED")) {
    return { ok: false, status: 401, errorType: "GATEWAY_SYSTEM_DISABLED", message: "Systeme externe desactive.", systemId: candidate.systemId };
  }
  return { ok: true, apiKeyId: candidate.id, systemId: candidate.systemId, scopes: candidate.scopes };
}

async function recordLog(input: {
  systemId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string | null;
  ipAddress: string | null;
  correlationId: string;
  requestId: string;
}) {
  await prisma.integrationLog.create({
    data: {
      systemId: input.systemId,
      endpoint: input.endpoint,
      method: input.method,
      statusCode: input.statusCode,
      responseTimeMs: input.responseTimeMs,
      success: input.success,
      errorMessage: input.errorMessage ?? null,
      ipAddress: input.ipAddress,
      correlationId: input.correlationId,
      requestId: input.requestId,
    },
  });
}

async function recordError(input: { systemId: string | null; endpoint: string; errorType: string; message: string }) {
  await prisma.integrationError.create({
    data: { systemId: input.systemId, endpoint: input.endpoint, errorType: input.errorType, message: input.message },
  });
}

type ResponseFormat = "json" | "xml";

function errorResponse(format: ResponseFormat, status: number, message: string, correlationId: string) {
  if (format === "xml") {
    return new NextResponse(buildSoapFault(message), { status, headers: { "Content-Type": "text/xml; charset=utf-8", "X-Correlation-Id": correlationId } });
  }
  const res = NextResponse.json({ error: message, correlationId }, { status });
  res.headers.set("X-Correlation-Id", correlationId);
  return res;
}

// Point d'entree unique pour une route /api/v1/*. `requiredScope` doit
// figurer dans les scopes accordes (cle API ou jeton OAuth2) pour que
// `handler` s'execute. Toute issue (succes ou echec, a quelque etape que
// ce soit) est journalisee. format="xml" (adapter SOAP, section 15) :
// `handler` renvoie directement une chaine XML complete (pas un objet a
// serialiser), et toute erreur (auth/scope/quota/handler) est renvoyee
// comme un SOAP Fault plutot qu'un JSON — un appelant SOAP ne doit jamais
// recevoir autre chose que du XML, meme en cas d'echec.
export async function runGatewayRequest<T>(
  req: NextRequest,
  requiredScope: string,
  handler: (ctx: GatewayContext) => Promise<T>,
  options: { format?: ResponseFormat } = {},
): Promise<NextResponse> {
  const format = options.format ?? "json";
  const start = Date.now();
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const requestId = randomBytes(8).toString("hex");
  const correlationId = req.headers.get("x-correlation-id")?.trim() || generateCorrelationId();
  const endpoint = new URL(req.url).pathname;
  const method = req.method;

  const auth = await authenticate(extractRawToken(req));
  if (!auth.ok) {
    await recordLog({ systemId: auth.systemId, endpoint, method, statusCode: auth.status, responseTimeMs: Date.now() - start, success: false, errorMessage: auth.message, ipAddress, correlationId, requestId });
    await recordError({ systemId: auth.systemId, endpoint, errorType: auth.errorType, message: auth.message });
    return errorResponse(format, auth.status, auth.message, correlationId);
  }

  if (!auth.scopes.includes(requiredScope)) {
    await recordLog({ systemId: auth.systemId, endpoint, method, statusCode: 403, responseTimeMs: Date.now() - start, success: false, errorMessage: `Scope manquant: ${requiredScope}`, ipAddress, correlationId, requestId });
    await recordError({ systemId: auth.systemId, endpoint, errorType: "GATEWAY_SCOPE_DENIED", message: `Scope manquant: ${requiredScope}` });
    return errorResponse(format, 403, `Permission insuffisante (scope requis: ${requiredScope}).`, correlationId);
  }

  const rateLimitKey = auth.apiKeyId ? `gateway:${auth.apiKeyId}` : `gateway:oauth:${auth.systemId}`;
  const system = auth.systemId ? await prisma.integrationSystem.findUnique({ where: { id: auth.systemId } }) : null;
  const maxPerMinute = system?.rateLimitPerMinute ?? 100;
  if (isRateLimited(rateLimitKey, 60_000, maxPerMinute)) {
    await recordLog({ systemId: auth.systemId, endpoint, method, statusCode: 429, responseTimeMs: Date.now() - start, success: false, errorMessage: "Quota depasse.", ipAddress, correlationId, requestId });
    await recordError({ systemId: auth.systemId, endpoint, errorType: "GATEWAY_RATE_LIMITED", message: `Quota de ${maxPerMinute} requetes/minute depasse.` });
    return errorResponse(format, 429, "Quota de requetes depasse.", correlationId);
  }

  try {
    const result = await handler({ apiKeyId: auth.apiKeyId, systemId: auth.systemId, scopes: auth.scopes, correlationId, requestId });
    if (auth.apiKeyId) {
      await prisma.integrationApiKey.update({ where: { id: auth.apiKeyId }, data: { lastUsedAt: new Date() } });
    }
    await recordLog({ systemId: auth.systemId, endpoint, method, statusCode: 200, responseTimeMs: Date.now() - start, success: true, ipAddress, correlationId, requestId });
    if (format === "xml") {
      return new NextResponse(result as string, { headers: { "Content-Type": "text/xml; charset=utf-8", "X-Correlation-Id": correlationId } });
    }
    const res = NextResponse.json(result);
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur interne.";
    await recordLog({ systemId: auth.systemId, endpoint, method, statusCode: status, responseTimeMs: Date.now() - start, success: false, errorMessage: message, ipAddress, correlationId, requestId });
    if (status >= 500) {
      await recordError({ systemId: auth.systemId, endpoint, errorType: "HANDLER_ERROR", message });
    }
    return errorResponse(format, status, message, correlationId);
  }
}
