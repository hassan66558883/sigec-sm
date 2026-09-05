"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "./icons";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible (contexte non securise, permission
      // refusee...) — echec silencieux, non bloquant pour l'utilisateur.
    }
  }

  return (
    <button
      onClick={onClick}
      title="Copier"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--tc-accent-soft)] hover:text-[var(--tc-accent-dark)]"
    >
      {copied ? <IconCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <IconCopy className="h-3.5 w-3.5" />}
    </button>
  );
}
