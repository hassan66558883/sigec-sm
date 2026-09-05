"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocationMap } from "@/components/municipal/location-map-loader";

const TYPE_OPTIONS = [
  { value: "PLAINTE", label: "Plainte" },
  { value: "DOLEANCE", label: "Doleance" },
  { value: "SIGNALEMENT", label: "Signalement" },
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "RECLAMATION", label: "Reclamation" },
  { value: "INTERVENTION", label: "Demande d'intervention" },
];

const STEPS = ["Type", "Localisation", "Description", "Verification", "Confirmation"] as const;

type Category = { id: string; code: string; name: string };
type Quartier = { id: string; name: string };

export function ComplaintForm({ categories, quartiers }: { categories: Category[]; quartiers: Quartier[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState("PLAINTE");
  const [category, setCategory] = useState(categories[0]?.code ?? "AUTRE");
  const [quartierId, setQuartierId] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedCase, setConfirmedCase] = useState<{ caseNumber: string; category: string; createdAt: string } | null>(null);

  const categoryName = categories.find((c) => c.code === category)?.name ?? category;

  function next() {
    if (step === 2 && !description.trim()) {
      setError("La description est requise.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/portal/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        category,
        quartierId: quartierId || undefined,
        address: address.trim() || undefined,
        landmark: landmark.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        title: title.trim() || undefined,
        description: description.trim(),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Echec de l'envoi.");
      return;
    }
    const { data } = await res.json();
    setConfirmedCase({ caseNumber: data.caseNumber, category: categoryName, createdAt: data.createdAt });
    setStep(4);
  }

  function resetAndClose() {
    setStep(0);
    setType("PLAINTE");
    setCategory(categories[0]?.code ?? "AUTRE");
    setQuartierId("");
    setAddress("");
    setLandmark("");
    setLatitude(null);
    setLongitude(null);
    setTitle("");
    setDescription("");
    setConfirmedCase(null);
    router.refresh();
  }

  // Etape "Pieces jointes" (section 35) volontairement absente de cet
  // assistant : un fichier ne peut etre rattache qu'a un dossier deja cree
  // (ComplaintAttachment.complaintId est une FK reelle), donc pas avant la
  // soumission. L'ajout de pieces jointes se fait apres coup, depuis la
  // liste "Mes plaintes" ci-dessous (voir AttachmentUploader dans page.tsx).

  if (step === 4 && confirmedCase) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-2xl text-[var(--color-success)]">✓</div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Votre demande a ete enregistree avec succes.</p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-primary)]">{confirmedCase.caseNumber}</p>
        </div>
        <dl className="mx-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-left text-xs text-[var(--color-text-muted)]">
          <dt>Date de depot</dt>
          <dd className="text-[var(--color-text)]">{new Date(confirmedCase.createdAt).toLocaleDateString("fr-FR")}</dd>
          <dt>Categorie</dt>
          <dd className="text-[var(--color-text)]">{confirmedCase.category}</dd>
          <dt>Statut</dt>
          <dd className="text-[var(--color-text)]">Soumis</dd>
        </dl>
        <p className="text-xs text-[var(--color-text-muted)]">
          Conservez ce numero pour suivre l&apos;evolution de votre dossier ci-dessous.
        </p>
        <button
          onClick={resetAndClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Deposer une autre demande
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {STEPS.slice(0, 4).map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                i <= step ? "text-white" : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
              style={i <= step ? { background: "var(--color-primary)" } : undefined}
            >
              {i + 1}
            </div>
            {i < 3 && <div className={`h-0.5 flex-1 ${i < step ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`} />}
          </div>
        ))}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Etape {step + 1} — {STEPS[step]}</p>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Type de demande</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Categorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              {categories.map((c) => (
                <option key={c.id} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Quartier (facultatif)</label>
            <select value={quartierId} onChange={(e) => setQuartierId(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm">
              <option value="">Non precise</option>
              {quartiers.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Adresse (facultatif)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Point de repere (facultatif)</label>
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="ex: pres du marche central" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Emplacement sur la carte (facultatif) — cliquez pour placer un repere
            </label>
            <LocationMap latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
            {latitude != null && longitude != null && (
              <button type="button" onClick={() => { setLatitude(null); setLongitude(null); }} className="mt-1 text-xs text-[var(--color-text-muted)] hover:underline">
                Retirer le repere
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Objet (facultatif)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre court" className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Description</label>
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm" />
          </div>
        </div>
      )}

      {step === 3 && (
        <dl className="grid grid-cols-3 gap-x-2 gap-y-2 text-sm">
          <dt className="text-[var(--color-text-muted)]">Type</dt>
          <dd className="col-span-2">{TYPE_OPTIONS.find((o) => o.value === type)?.label}</dd>
          <dt className="text-[var(--color-text-muted)]">Categorie</dt>
          <dd className="col-span-2">{categoryName}</dd>
          <dt className="text-[var(--color-text-muted)]">Quartier</dt>
          <dd className="col-span-2">{quartiers.find((q) => q.id === quartierId)?.name ?? "Non precise"}</dd>
          {address && (<><dt className="text-[var(--color-text-muted)]">Adresse</dt><dd className="col-span-2">{address}</dd></>)}
          {latitude != null && longitude != null && (
            <><dt className="text-[var(--color-text-muted)]">Repere carte</dt><dd className="col-span-2">{latitude.toFixed(5)}, {longitude.toFixed(5)}</dd></>
          )}
          {title && (<><dt className="text-[var(--color-text-muted)]">Objet</dt><dd className="col-span-2">{title}</dd></>)}
          <dt className="text-[var(--color-text-muted)]">Description</dt>
          <dd className="col-span-2 whitespace-pre-wrap">{description}</dd>
        </dl>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={back} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
            Retour
          </button>
        )}
        {step < 3 && (
          <button onClick={next} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--color-primary)" }}>
            Suivant
          </button>
        )}
        {step === 3 && (
          <button onClick={submit} disabled={loading} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
            {loading ? "Envoi..." : "Deposer la demande"}
          </button>
        )}
      </div>
    </div>
  );
}
