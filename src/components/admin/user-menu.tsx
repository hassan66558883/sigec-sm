"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { IconChevronDown } from "@/components/icons";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? [parts[0][0], parts[1][0]] : [name.slice(0, 2)]).join("").toUpperCase();
}

export function UserMenu({
  name,
  roleLabel,
  changePasswordLabel,
  logoutLabel,
  changePasswordHref = "/admin/reset-password",
}: {
  name: string;
  roleLabel: string;
  changePasswordLabel: string;
  logoutLabel: string;
  changePasswordHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-[var(--color-surface-hover)]"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
          style={{ background: "var(--gradient-primary)" }}
        >
          {initials(name)}
        </span>
        <span className="hidden text-start sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-medium text-[var(--color-text)]">{name}</span>
          <span className="block max-w-[9rem] truncate text-xs text-[var(--color-text-muted)]">{roleLabel}</span>
        </span>
        <IconChevronDown className="hidden h-4 w-4 text-[var(--color-text-muted)] sm:block" />
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-md">
          <Link
            href={changePasswordHref}
            className="block rounded-md px-3 py-2 text-start text-sm text-[var(--color-text)] transition hover:bg-[var(--color-surface-hover)]"
          >
            {changePasswordLabel}
          </Link>
          <div className="my-1 border-t border-[var(--color-border-subtle)]" />
          <LogoutButton label={logoutLabel} />
        </div>
      )}
    </div>
  );
}
