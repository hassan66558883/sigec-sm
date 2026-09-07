import { SignJWT, jwtVerify } from "jose";

// OAuth2 client_credentials (section 16) — jetons d'acces courts,
// autoportants (JWT, meme mecanisme que les sessions agent dans
// lib/auth.ts mais avec une cle DEDIEE : ce sont deux domaines de
// confiance distincts, un jeton de session utilisateur ne doit jamais
// pouvoir etre rejoue comme jeton d'integration systeme-a-systeme, et
// inversement). Pas de rafraichissement/revocation avant expiration —
// duree de vie volontairement courte (1h) pour que ce soit un compromis
// acceptable plutot qu'une file de jetons a stocker/revoquer.
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

function getSecretKey() {
  const secret = process.env.OAUTH_TOKEN_SECRET;
  if (!secret) throw new Error("OAUTH_TOKEN_SECRET n'est pas defini.");
  return new TextEncoder().encode(secret);
}

export type OAuthAccessTokenPayload = {
  sub: string; // systemId
  client_id: string;
  scope: string; // scopes separes par des espaces, convention OAuth2 standard (RFC 6749 section 3.3)
};

export async function issueAccessToken(payload: OAuthAccessTokenPayload): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export type VerifiedOAuthToken = { systemId: string; clientId: string; scopes: string[] };

export async function verifyAccessToken(token: string): Promise<VerifiedOAuthToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.client_id !== "string" || typeof payload.scope !== "string") {
      return null;
    }
    return { systemId: payload.sub, clientId: payload.client_id, scopes: payload.scope.split(" ").filter(Boolean) };
  } catch {
    return null;
  }
}

// Un JWT a toujours 2 points (3 segments) — une cle API "sigk_..." n'en a
// aucun. Suffisant pour distinguer les deux formats sans essayer de
// decoder/verifier a l'aveugle (voir gateway.ts).
export function looksLikeJwt(value: string): boolean {
  return value.split(".").length === 3;
}
