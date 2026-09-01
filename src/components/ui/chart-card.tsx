import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

// Coquille rendue cote serveur : le graphique reel (recharts, "use client")
// est passe en children, ce qui garde la frontiere client la plus petite
// possible — seul le contenu du graphique est hydrate, pas le titre/l'entete.
export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  children,
  isEmpty = false,
  emptyLabel = "Aucune donnee pour le moment.",
  height = "h-72",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  height?: string;
}) {
  return (
    <Card padding="p-0">
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      <div className={`${height} p-4`}>
        {isEmpty ? <EmptyState title={emptyLabel} compact /> : children}
      </div>
    </Card>
  );
}
