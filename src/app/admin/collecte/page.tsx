import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CollecteClient } from "./collecte-client";
import { PageHeading } from "@/components/ui/page-header";

// Interface de collecte terrain (section 13) : recherche contribuable ->
// obligations en attente -> paiement -> reçu. Volontairement simple et
// rapide (usage tablette/telephone), reutilise l'interface admin existante
// (aucune UI/appli separee).
export default async function CollectePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "create")) redirect("/admin");

  // Si l'agent connecte a une fiche AgentCollecteur, ses paiements y sont
  // automatiquement rattaches (agent + caisse ouverte le cas echeant) —
  // condition necessaire au rapprochement de caisse (section 20) et au
  // controle de zone (section 22).
  const agent = await prisma.agentCollecteur.findUnique({ where: { userId: user.id } });

  return (
    <div className="space-y-4">
      <PageHeading
        title="Collecte terrain"
        description={
          <>
            Recherchez un contribuable pour encaisser une obligation en attente.
            {!agent && (
              <span className="mt-1 block text-xs text-[var(--color-warning)]">
                Votre compte n&apos;est pas rattache a une fiche agent collecteur : les paiements enregistres ici ne
                seront pas imputes a une caisse.
              </span>
            )}
          </>
        }
      />
      <CollecteClient agentId={agent?.id ?? null} />
    </div>
  );
}
