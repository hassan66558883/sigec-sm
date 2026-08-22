import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { CollecteClient } from "./collecte-client";

// Interface de collecte terrain (section 13) : recherche contribuable ->
// obligations en attente -> paiement -> reçu. Volontairement simple et
// rapide (usage tablette/telephone), reutilise l'interface admin existante
// (aucune UI/appli separee).
export default async function CollectePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user, "payments", "create")) redirect("/admin");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Collecte terrain</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Recherchez un contribuable pour encaisser une obligation en attente.
        </p>
      </div>
      <CollecteClient />
    </div>
  );
}
