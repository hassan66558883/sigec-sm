// Documentation automatique des APIs (section 22) — reflete UNIQUEMENT les
// endpoints /api/v1/* qui existent reellement (voir src/app/api/v1/) et
// fonctionnent via l'API Gateway. Jamais d'endpoint documente qui n'a pas
// de veritable implementation derriere (section 43 : "no mock screens").
// Mis a jour manuellement a chaque nouvel endpoint v1 — pas de generation
// automatique a partir des routes (le projet n'a pas cette infrastructure,
// et une liste courte et exacte vaut mieux qu'une generation fragile).
export function getOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "SIGEC-SM — API d'integration",
      version: "1.0.0",
      description:
        "APIs versionnees exposees par l'API Gateway de SIGEC-SM aux systemes externes autorises (banques, mobile money, administrations, ERP...). " +
        "Authentification par cle API (Authorization: Bearer <cle> ou X-API-Key). Voir /admin/integration/api-keys pour generer une cle.",
    },
    servers: [{ url: baseUrl }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "sigk_...",
          description: "Cle API generee depuis /admin/integration/api-keys. Alternative : en-tete X-API-Key.",
        },
      },
      schemas: {
        Citizen: {
          type: "object",
          properties: {
            id: { type: "string" },
            uniqueNumber: { type: "string", example: "CIT-2026-7A925129" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            dateOfBirth: { type: "string", format: "date-time", nullable: true },
            sex: { type: "string", enum: ["M", "F"] },
            arrondissementId: { type: "string" },
            isDeceased: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" }, correlationId: { type: "string" } },
        },
      },
    },
    paths: {
      "/api/v1/citizens": {
        get: {
          summary: "Liste des citoyens (champs minimaux)",
          description: "Scope requis : citizens:read. Pagination via ?page=.",
          parameters: [{ name: "page", in: "query", schema: { type: "integer", default: 1 } }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { $ref: "#/components/schemas/Citizen" } },
                      page: { type: "integer" },
                      pageSize: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Cle API absente ou invalide", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Scope manquant" },
            "429": { description: "Quota depasse" },
          },
        },
      },
      "/api/v1/citizens/{id}": {
        get: {
          summary: "Detail d'un citoyen",
          description: "Scope requis : citizens:read.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Citizen" } } } },
            "404": { description: "Citoyen introuvable" },
          },
        },
      },
      "/api/v1/qr/verify": {
        post: {
          summary: "Verification d'un document via son token QR",
          description: "Scope requis : documents:verify. Reutilise le meme service que /verify/{token} (public, citoyen), avec journalisation et quota systeme-a-systeme.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string" } } } } },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      found: { type: "boolean" },
                      valid: { type: "boolean" },
                      status: { type: "string" },
                      typeName: { type: "string" },
                      documentNumber: { type: "string" },
                      issuedAt: { type: "string", format: "date-time" },
                      authority: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "Champ 'token' manquant" },
          },
        },
      },
    },
  };
}

// Liste plate utilisee par la console API Tester (endpoint + methode +
// corps par defaut) — derivee de la meme source que le spec ci-dessus,
// jamais une seconde liste divergente.
export const TESTABLE_ENDPOINTS = [
  { method: "GET", path: "/api/v1/citizens", body: null },
  { method: "GET", path: "/api/v1/citizens/{id}", body: null },
  { method: "POST", path: "/api/v1/qr/verify", body: { token: "" } },
] as const;
