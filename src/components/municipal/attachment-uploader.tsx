"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from "@/lib/complaint-attachment-constants";

export function AttachmentUploader({ uploadUrl }: { uploadUrl: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Type de fichier non autorise (image JPEG/PNG/WEBP ou PDF uniquement).");
      return;
    }
    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      setError("Fichier trop volumineux (10 Mo maximum).");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Echec de l'envoi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Echec de l'envoi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
      >
        {loading ? "Envoi..." : "Ajouter une piece jointe"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ALLOWED_MIME_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
