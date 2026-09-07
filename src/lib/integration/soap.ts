import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ApiError } from "@/lib/api";

// SOAP/Legacy Adapter (section 15) — REST <-> SOAP/XML pour les systemes
// anciens qui ne parlent pas REST/JSON. Reutilise TOUJOURS les memes
// fonctions de service que les endpoints REST equivalents
// (integration-v1.ts) : le SOAP n'est qu'une couche de traduction, jamais
// une deuxieme implementation metier.
//
// fast-xml-parser (pas de parseur maison) : desactive par defaut le
// traitement des entites externes (pas de risque XXE), essentiel pour
// analyser du XML fourni par un appelant non fiable.

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SoapRequest = { operation: string; params: Record<string, string> };

// Un corps SOAP <Body> ne contient qu'UN element enfant : son nom EST le
// nom de l'operation demandee (convention RFC-like SOAP "document/literal
// wrapped"), ses propres enfants sont les parametres.
export function parseSoapRequest(xml: string): SoapRequest {
  // XMLParser.parse() est volontairement permissif (il ne leve pas
  // d'exception sur des balises mal fermees/imbriquees, il produit juste
  // une structure erronee) — XMLValidator.validate() est le SEUL moyen
  // fiable de detecter un XML reellement mal forme avant de l'interpreter.
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new ApiError(400, "Enveloppe SOAP invalide (XML mal forme).");
  }
  const parsed: unknown = parser.parse(xml);
  const envelope = (parsed as Record<string, unknown>)?.Envelope as Record<string, unknown> | undefined;
  if (envelope?.Body === undefined) throw new ApiError(400, "Enveloppe SOAP invalide : soapenv:Body introuvable.");

  // Un <Body/> vide est parse en chaine vide (falsy, mais bien present) —
  // distinct du cas "Body absent" ci-dessus, d'ou une verification
  // separee plutot qu'un simple `if (!body)`.
  const body = envelope.Body;
  const operation = body && typeof body === "object" ? Object.keys(body as Record<string, unknown>)[0] : undefined;
  if (!operation) throw new ApiError(400, "Enveloppe SOAP invalide : aucune operation dans le Body.");

  const raw = (body as Record<string, unknown>)[operation];
  const params: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      params[key] = String(value);
    }
  }
  return { operation, params };
}

export function buildSoapResponse(operation: string, resultXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <${operation}Response>
${resultXml}
    </${operation}Response>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function buildSoapFault(faultString: string, faultCode = "soapenv:Client"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>${faultCode}</faultcode>
      <faultstring>${escapeXml(faultString)}</faultstring>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Petit generateur XML pour un objet plat (jamais imbrique) — suffisant
// pour les reponses SOAP volontairement minimales de ce module (section
// 41, memes champs que les reponses REST equivalentes). Chaque valeur est
// echappee, jamais interpolee brute. Une Date est serialisee en ISO 8601
// (comme le ferait JSON.stringify), jamais via son toString() JS par defaut.
export function objectToXml(obj: Record<string, unknown>, indent = "      "): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const raw = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
      return `${indent}<${key}>${escapeXml(raw)}</${key}>`;
    })
    .join("\n");
}

// Enveloppe SOAP pour un lot du Synchronization Engine (section 13) vers un
// systeme protocol=SOAP — meme contenu que le lot JSON equivalent
// (integration-sync.ts), juste une serialisation XML au lieu de JSON, pour
// qu'un recepteur legacy SOAP puisse recevoir les memes exports par lot
// qu'un recepteur REST/JSON.
export function buildSoapSyncBatch(entityType: string, records: Record<string, unknown>[], syncedAt: string): string {
  const recordsXml = records
    .map((record) => `      <record>\n${objectToXml(record, "        ")}\n      </record>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <SyncBatch>
      <entityType>${escapeXml(entityType)}</entityType>
      <syncedAt>${escapeXml(syncedAt)}</syncedAt>
      <records>
${recordsXml}
      </records>
    </SyncBatch>
  </soapenv:Body>
</soapenv:Envelope>`;
}
