import { describe, it, expect } from "vitest";
import { csrfTokensMatch, generateCsrfToken, isCsrfExempt, requiresCsrfCheck } from "../src/lib/csrf-server";

// Protection CSRF (double-submit cookie, voir proxy.ts) : ces fonctions
// pures sont testables sans passer par la machinerie de requete Next.js —
// le comportement de proxy.ts lui-meme est verifie manuellement (voir
// docs/DEPLOYMENT.md et la session de verification navigateur).
describe("CSRF (double-submit cookie)", () => {
  it("generateCsrfToken produit des jetons distincts, suffisamment longs", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("csrfTokensMatch accepte uniquement une correspondance exacte", () => {
    const token = generateCsrfToken();
    expect(csrfTokensMatch(token, token)).toBe(true);
    expect(csrfTokensMatch(token, generateCsrfToken())).toBe(false);
  });

  it("csrfTokensMatch rejette les valeurs manquantes ou vides", () => {
    const token = generateCsrfToken();
    expect(csrfTokensMatch(undefined, token)).toBe(false);
    expect(csrfTokensMatch(token, undefined)).toBe(false);
    expect(csrfTokensMatch(token, null)).toBe(false);
    expect(csrfTokensMatch("", "")).toBe(false);
  });

  it("csrfTokensMatch rejette les longueurs differentes sans planter", () => {
    expect(csrfTokensMatch("short", "much-longer-value")).toBe(false);
  });

  it("requiresCsrfCheck ne s'applique qu'aux methodes mutantes", () => {
    expect(requiresCsrfCheck("POST")).toBe(true);
    expect(requiresCsrfCheck("PUT")).toBe(true);
    expect(requiresCsrfCheck("PATCH")).toBe(true);
    expect(requiresCsrfCheck("DELETE")).toBe(true);
    expect(requiresCsrfCheck("GET")).toBe(false);
    expect(requiresCsrfCheck("HEAD")).toBe(false);
    expect(requiresCsrfCheck("OPTIONS")).toBe(false);
  });

  it("isCsrfExempt ne couvre que les webhooks/cron sans session navigateur", () => {
    expect(isCsrfExempt("/api/payments/callback/manual")).toBe(true);
    expect(isCsrfExempt("/api/cron/relances")).toBe(true);
    expect(isCsrfExempt("/api/departments")).toBe(false);
    expect(isCsrfExempt("/api/technotchad/clients")).toBe(false);
    expect(isCsrfExempt("/api/auth/login")).toBe(false);
  });
});
