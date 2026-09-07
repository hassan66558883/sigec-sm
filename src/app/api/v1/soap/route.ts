import { NextRequest } from "next/server";
import { runGatewayRequest } from "@/lib/integration/gateway";
import { parseSoapRequest, buildSoapResponse, objectToXml } from "@/lib/integration/soap";
import { ApiError } from "@/lib/api";
import { getCitizenForIntegration } from "@/lib/services/integration-v1";
import { verifyCertificatePublic } from "@/lib/services/certificates";

// SOAP/Legacy Adapter (section 15) — REST <-> SOAP/XML pour les systemes
// anciens. Deux operations exposees (memes donnees, memes regles de
// confidentialite que les endpoints REST equivalents — jamais une
// deuxieme implementation metier, seulement une traduction) :
//   GetCitizen        <id>...</id>          -> memes champs que GET /api/v1/citizens/{id}
//   VerifyDocument     <token>...</token>    -> meme service que POST /api/v1/qr/verify
export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  return runGatewayRequest(
    req,
    "soap:legacy",
    async () => {
      // Le parsing se fait ICI (dans le handler, pas avant l'appel a
      // runGatewayRequest) pour qu'une enveloppe mal formee declenche le
      // meme traitement d'erreur (ApiError -> SOAP Fault) que toute autre
      // erreur du handler — jamais une exception brute qui echapperait au
      // format=xml et casserait la garantie "un appelant SOAP ne recoit
      // jamais autre chose que du XML, meme en cas d'echec".
      const { operation, params } = parseSoapRequest(bodyText);

      if (operation === "GetCitizen") {
        if (!params.id) throw new ApiError(400, "Le parametre 'id' est requis.");
        const citizen = await getCitizenForIntegration(params.id);
        return buildSoapResponse("GetCitizen", objectToXml({ ...citizen, dateOfBirth: citizen.dateOfBirth?.toISOString() ?? "" }));
      }
      if (operation === "VerifyDocument") {
        if (!params.token) throw new ApiError(400, "Le parametre 'token' est requis.");
        const result = await verifyCertificatePublic(params.token);
        if (!result.found) return buildSoapResponse("VerifyDocument", objectToXml({ found: false }));
        return buildSoapResponse("VerifyDocument", objectToXml({ found: true, valid: result.valid, status: result.status, typeName: result.typeName, documentNumber: result.documentNumber, issuedAt: result.issuedAt.toISOString(), authority: result.authority }));
      }
      throw new ApiError(400, `Operation SOAP inconnue : ${operation}.`);
    },
    { format: "xml" },
  );
}
