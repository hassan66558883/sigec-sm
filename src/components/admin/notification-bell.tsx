"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconBell } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import { makeT, type Dictionary } from "@/lib/i18n/translate";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  link: string | null;
  createdAt: string;
  isRead: boolean;
};

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-[var(--color-info)]",
  WARNING: "bg-[var(--color-warning)]",
  CRITICAL: "bg-[var(--color-danger)]",
};

// Cloche + panneau deroulant (section 6/30). Reutilise l'API
// /api/notifications deja existante (utilisee jusqu'ici uniquement par la
// page complete /admin/notifications) — aucune nouvelle route necessaire
// pour cette lecture ; PATCH /api/notifications/[id] deja existant pour le
// marquage individuel.
export function NotificationBell({ dict, initialUnread }: { dict: Dictionary; initialUnread: number }) {
  const t = makeT(dict);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);
  const loading = open && items === null;

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    if (!open || items !== null) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.data ?? []);
        setUnread(data.unreadCount ?? 0);
      });
  }, [open, items]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? prev);
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("topbar.notifications")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <IconBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md">
          <div className="border-b border-[var(--color-border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)]">{t("topbar.notifications")}</div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <SkeletonText lines={3} />
              </div>
            ) : !items || items.length === 0 ? (
              <EmptyState title={t("topbar.noNotifications")} compact />
            ) : (
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {items.slice(0, 8).map((n) => (
                  <li key={n.id} className={`px-4 py-2.5 text-sm transition hover:bg-[var(--color-surface-hover)] ${n.isRead ? "" : "bg-[var(--color-primary-light)]/40"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? "bg-[var(--color-text-muted)]"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--color-text)]">{n.title}</p>
                        <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">{n.message}</p>
                        {!n.isRead && (
                          <button onClick={() => markRead(n.id)} className="mt-1 text-xs text-[var(--color-primary)] hover:underline">
                            Marquer comme lue
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/admin/notifications"
            className="block border-t border-[var(--color-border-subtle)] px-4 py-2.5 text-center text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t("topbar.viewAllNotifications")}
          </Link>
        </div>
      )}
    </div>
  );
}
