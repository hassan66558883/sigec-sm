"use client";

import dynamic from "next/dynamic";

// Leaflet touche `window`/`document` des l'initialisation du module —
// chargement cote client uniquement (voir node_modules/next/dist/docs/
// 01-app/02-guides/lazy-loading.md, section "Skipping SSR").
export const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
      Chargement de la carte...
    </div>
  ),
});
