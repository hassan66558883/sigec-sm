"use client";

// Patch global de window.fetch : ajoute automatiquement l'en-tete
// X-CSRF-Token (lu depuis le cookie non-httpOnly pose par proxy.ts) sur
// toute requete mutante vers notre propre origine. Evite de devoir modifier
// chacun des tres nombreux appels fetch() deja ecrits dans les composants
// (formulaires, boutons d'action...) — un seul point d'injection, applique
// une fois au chargement de l'application.
import { useEffect } from "react";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PATCHED_FLAG = "__sigecsmCsrfFetchPatched";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function patchFetch() {
  const win = window as typeof window & { [PATCHED_FLAG]?: boolean };
  if (win[PATCHED_FLAG]) return;
  win[PATCHED_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!UNSAFE_METHODS.has(method)) return originalFetch(input, init);

    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isSameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
    if (!isSameOrigin) return originalFetch(input, init);

    const token = readCookie(CSRF_COOKIE);
    if (!token) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(CSRF_HEADER, token);
    return originalFetch(input, { ...init, headers });
  };
}

export function CsrfInit() {
  useEffect(patchFetch, []);
  return null;
}
