import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api";

// API Gateway (Integration & Interoperability Center, section 2/6/38) —
// point d'entree UNIQUE pour tout systeme externe. Aucune route /api/v1/*
// n'accede a Prisma sans etre passee par runGatewayRequest() ci-dessous :
// authentification par cle API, verification de scope, quota par systeme,
// et journalisation de CHAQUE appel (succes ou echec) dans IntegrationLog,
// avec un IntegrationError cree pour tout rejet (auth/scope/quota).
//
// Distinct de l'authentification par cookie de session (lib/auth.ts) :
// un systeme externe n'a jamais de session navigateur, uniquement une cle
// API dans l'en-tete Authorization.

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

function extractRawKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const headerKey = req.headers.get("x-api-key");
  return headerKey?.trim() || null;
}

export type GatewayContext = {
  apiKeyId: string;
  systemId: string | null;
  scopes: string[];
  correlationId: string;
  requestId: string;
};

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

function jsonError(status: number, message: string, correlationId: string) {
  const res = NextResponse.json({ error: message, correlationId }, { status });
  res.headers.set("X-Correlation-Id", correlationId);
  return res;
}

// Point d'entree unique pour une route /api/v1/*. `requiredScope` doit
// figurer dans les scopes de la cle API pour que `handler` s'execute. Toute
// issue (succes ou echec, a quelque etape que ce soit) est journalisee.
export async function runGatewayRequest<T>(
  req: NextRequest,
  requiredScope: string,
  handler: (ctx: GatewayContext) => Promise<T>,
): Promise<NextResponse> {
  const start = Date.now();
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const requestId = randomBytes(8).toString("hex");
  const correlationId = req.headers.get("x-correlation-id")?.trim() || generateCorrelationId();
  const endpoint = new URL(req.url).pathname;
  const method = req.method;

  const rawKey = extractRawKey(req);
  if (!rawKey || !rawKey.startsWith("sigk_")) {
    await recordLog({ systemId: null, endpoint, method, statusCode: 401, responseTimeMs: Date.now() - start, success: false, errorMessage: "Cle API absente ou mal formee.", ipAddress, correlationId, requestId });
    await recordError({ systemId: null, endpoint, errorType: "GATEWAY_AUTH_MISSING", message: "Cle API absente ou mal formee." });
    return jsonError(401, "Cle API requise (Authorization: Bearer <cle> ou X-API-Key).", correlationId);
  }

  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  const candidate = await prisma.integrationApiKey.findUnique({ where: { keyPrefix }, include: { system: true } });
  const valid = candidate && (await bcrypt.compare(rawKey, candidate.keyHash));

  if (!valid) {
    await recordLog({ systemId: candidate?.systemId ?? null, endpoint, method, statusCode: 401, responseTimeMs: Date.now() - start, success: false, errorMessage: "Cle API invalide.", ipAddress, correlationId, requestId });
    await recordError({ systemId: candidate?.systemId ?? null, endpoint, errorType: "GATEWAY_AUTH_INVALID", message: "Cle API invalide." });
    return jsonError(401, "Cle API invalide.", correlationId);
  }

  if (candidate.status !== "ACTIVE" || (candidate.expiresAt && candidate.expiresAt < new Date())) {
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: 401, responseTimeMs: Date.now() - start, success: false, errorMessage: `Cle API ${candidate.status === "ACTIVE" ? "expiree" : candidate.status.toLowerCase()}.`, ipAddress, correlationId, requestId });
    await recordError({ systemId: candidate.systemId, endpoint, errorType: "GATEWAY_AUTH_INACTIVE", message: `Cle API ${candidate.status.toLowerCase()}${candidate.expiresAt && candidate.expiresAt < new Date() ? " (expiree)" : ""}.` });
    return jsonError(401, "Cle API revoquee, desactivee ou expiree.", correlationId);
  }

  if (candidate.system && (!candidate.system.enabled || candidate.system.status === "DISABLED")) {
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: 401, responseTimeMs: Date.now() - start, success: false, errorMessage: "Systeme externe desactive.", ipAddress, correlationId, requestId });
    await recordError({ systemId: candidate.systemId, endpoint, errorType: "GATEWAY_SYSTEM_DISABLED", message: "Le systeme externe rattache a cette cle est desactive." });
    return jsonError(401, "Systeme externe desactive.", correlationId);
  }

  if (!candidate.scopes.includes(requiredScope)) {
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: 403, responseTimeMs: Date.now() - start, success: false, errorMessage: `Scope manquant: ${requiredScope}`, ipAddress, correlationId, requestId });
    await recordError({ systemId: candidate.systemId, endpoint, errorType: "GATEWAY_SCOPE_DENIED", message: `Scope manquant: ${requiredScope}` });
    return jsonError(403, `Permission insuffisante (scope requis: ${requiredScope}).`, correlationId);
  }

  const maxPerMinute = candidate.system?.rateLimitPerMinute ?? 100;
  if (isRateLimited(`gateway:${candidate.id}`, 60_000, maxPerMinute)) {
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: 429, responseTimeMs: Date.now() - start, success: false, errorMessage: "Quota depasse.", ipAddress, correlationId, requestId });
    await recordError({ systemId: candidate.systemId, endpoint, errorType: "GATEWAY_RATE_LIMITED", message: `Quota de ${maxPerMinute} requetes/minute depasse.` });
    return jsonError(429, "Quota de requetes depasse.", correlationId);
  }

  try {
    const result = await handler({ apiKeyId: candidate.id, systemId: candidate.systemId, scopes: candidate.scopes, correlationId, requestId });
    await prisma.integrationApiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: 200, responseTimeMs: Date.now() - start, success: true, ipAddress, correlationId, requestId });
    const res = NextResponse.json(result);
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur interne.";
    await recordLog({ systemId: candidate.systemId, endpoint, method, statusCode: status, responseTimeMs: Date.now() - start, success: false, errorMessage: message, ipAddress, correlationId, requestId });
    if (status >= 500) {
      await recordError({ systemId: candidate.systemId, endpoint, errorType: "HANDLER_ERROR", message });
    }
    return jsonError(status, message, correlationId);
  }
}
