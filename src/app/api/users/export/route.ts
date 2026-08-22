import { requirePermission, handleApiError } from "@/lib/api";
import { listUsers } from "@/lib/services/users";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requirePermission("users", "export");
    const users = await listUsers(user);
    const csv = toCsv(users, [
      { header: "Nom", value: (u) => u.name },
      { header: "Email", value: (u) => u.email },
      { header: "Telephone", value: (u) => u.phone },
      { header: "Roles", value: (u) => u.roles.map((r) => r.role.name).join("; ") },
      { header: "Niveau", value: (u) => (u.organizationLevel === "CENTRAL" ? "Mairie Centrale" : "Arrondissement") },
      { header: "Arrondissements", value: (u) => u.arrondissements.map((a) => a.arrondissement.code).join("; ") },
      { header: "Statut", value: (u) => (u.isActive ? "Actif" : "Inactif") },
    ]);
    return csvResponse(`utilisateurs_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (error) {
    return handleApiError(error);
  }
}
