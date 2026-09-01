"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconSearch, IconX } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { makeT, type Dictionary, type TranslationKey } from "@/lib/i18n/translate";
import type { SearchResult, SearchResultType } from "@/lib/services/search";

const TYPE_KEY: Record<SearchResultType, TranslationKey> = {
  citizens: "search.typeCitizens",
  births: "search.typeBirths",
  marriages: "search.typeMarriages",
  deaths: "search.typeDeaths",
  certificates: "search.typeCertificates",
  applications: "search.typeApplications",
  payments: "search.typePayments",
};

const DEBOUNCE_MS = 250;

// Recherche globale (section 25). Debounce + panneau deroulant, appelle
// GET /api/search?q= (voir src/app/api/search/route.ts). Limitation
// connue documentee dans le plan : 5 des 7 types de resultats renvoient
// vers la liste brute du module (pas de route de detail aujourd'hui).
export function GlobalSearch({ dict }: { dict: Dictionary }) {
  const t = makeT(dict);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [resultsQuery, setResultsQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedQuery = query.trim();
  const loading = trimmedQuery.length >= 2 && resultsQuery !== trimmedQuery;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmedQuery.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);
      const data = await res.json();
      setResults(data.data ?? []);
      setResultsQuery(trimmedQuery);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery]);

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 transition focus-within:border-[var(--color-primary)]/40 focus-within:bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15">
        <IconSearch className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("topbar.searchPlaceholder")}
          className="w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults(null);
              setResultsQuery(null);
            }}
            aria-label="Effacer"
            className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && trimmedQuery.length >= 2 && (
        <div className="absolute start-0 z-50 mt-2 max-h-96 w-full overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md">
          {loading ? (
            <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">{t("search.searching")}</div>
          ) : !results || results.length === 0 ? (
            <EmptyState title={t("search.noResults")} compact />
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--color-text)]">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-[var(--color-text-muted)]">{r.subtitle}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      {t(TYPE_KEY[r.type])}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
