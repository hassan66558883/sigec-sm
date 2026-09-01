export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--color-border-subtle)] ${className}`} />;
}

export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

// Utilise comme fallback <Suspense> pour les sections graphique du tableau
// de bord — meme gabarit qu'un ChartCard pour eviter tout saut de mise en
// page quand les donnees agregees (requetes SQL plus lourdes) arrivent.
export function SkeletonCard({ height = "h-72" }: { height?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-3.5">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className={`${height} p-4`}>
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}
