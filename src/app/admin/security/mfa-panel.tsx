"use client";

import { useState } from "react";

type SetupState = { secret: string; qrDataUrl: string } | null;

export function MfaPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupState>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onBegin() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mfa/setup/begin", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Echec du demarrage de la configuration.");
      return;
    }
    setSetup(data.data);
    setCode("");
  }

  async function onConfirm() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mfa/setup/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Code invalide.");
      return;
    }
    setBackupCodes(data.data.backupCodes);
    setSetup(null);
    setEnabled(true);
  }

  async function onDisable() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Code invalide.");
      return;
    }
    setEnabled(false);
    setDisabling(false);
    setCode("");
  }

  if (backupCodes) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-sm text-[var(--color-text)]">
          MFA active. Notez ces codes de secours dans un endroit sur — ils ne seront plus jamais affiches. Chacun ne fonctionne qu&apos;une seule fois, en cas de perte de votre appareil authenticator.
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <button
          onClick={() => setBackupCodes(null)}
          className="w-full rounded-md py-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          J&apos;ai enregistre mes codes
        </button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          MFA active sur ce compte
        </div>
        {!disabling ? (
          <button
            onClick={() => {
              setDisabling(true);
              setError(null);
              setCode("");
            }}
            className="rounded-md border border-[var(--color-danger)]/40 px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          >
            Desactiver le MFA
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              Confirmez avec un code de votre authenticator (ou un code de secours)
            </label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="123456"
            />
            <div className="flex gap-2">
              <button
                onClick={onDisable}
                disabled={loading || !code}
                className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? "..." : "Confirmer la desactivation"}
              </button>
              <button onClick={() => setDisabling(false)} className="text-sm text-[var(--color-text-muted)]">
                Annuler
              </button>
            </div>
          </div>
        )}
        {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}
      </div>
    );
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Scannez ce QR code avec votre application authenticator, puis saisissez le code affiche pour confirmer.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL genere cote serveur, pas une image a optimiser */}
        <img src={setup.qrDataUrl} alt="QR code MFA" className="mx-auto h-48 w-48" />
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Saisie manuelle : <span className="font-mono">{setup.secret}</span>
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Code a 6 chiffres</label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="123456"
          />
        </div>
        {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={loading || !code}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {loading ? "..." : "Confirmer et activer"}
          </button>
          <button onClick={() => setSetup(null)} className="text-sm text-[var(--color-text-muted)]">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-muted)]">
        Le MFA n&apos;est pas active. Une fois active, un code a usage unique genere par une application
        authenticator sera exige a chaque connexion, en plus du mot de passe.
      </p>
      {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}
      <button
        onClick={onBegin}
        disabled={loading}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {loading ? "..." : "Activer le MFA"}
      </button>
    </div>
  );
}
