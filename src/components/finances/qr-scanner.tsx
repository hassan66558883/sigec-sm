"use client";

import { useRef, useState } from "react";

// Extrait le token depuis soit l'URL complete encodee dans le QR
// (`.../pay/<token>`), soit un token colle brut (agent qui tape/colle le
// code sans passer par la camera).
function extractToken(raw: string): string {
  const match = raw.trim().match(/\/pay\/([^/?#]+)/);
  return match ? match[1] : raw.trim();
}

// Scanner QR pour la collecte terrain (section 21). Utilise l'API native
// BarcodeDetector (Chrome/Android — le navigateur reel des agents sur le
// terrain) quand disponible. Le support n'est jamais verifie au montage
// (evite tout setState dans un effet, et toute divergence SSR/client) : le
// clic sur "Activer la camera" verifie et agit dans le meme geste, avec un
// message clair si l'API est absente — jamais un bouton qui ne fait rien
// (regle "chaque bouton doit fonctionner"), la saisie manuelle restant
// toujours disponible en repli.
export function QrScanner({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startCamera() {
    setError(null);
    if (typeof window === "undefined" || !("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setError("Scanner QR non supporte par ce navigateur — utilisez la saisie manuelle ci-dessous.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningRef.current = true;
      setScanning(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });

      const loop = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue as string;
              stopCamera();
              onToken(extractToken(value));
              return;
            }
          } catch {
            // frame illisible — on retente a la prochaine image
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setError("Camera inaccessible — verifiez les permissions du navigateur.");
      stopCamera();
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualValue.trim()) return;
    onToken(extractToken(manualValue));
    setManualValue("");
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-sm font-medium">Scanner le QR de l&apos;etablissement</div>

      <div className="space-y-2">
        {scanning ? (
          <>
            <video ref={videoRef} className="w-full rounded-md border border-[var(--color-border)]" muted playsInline />
            <button onClick={stopCamera} className="w-full rounded-md border border-[var(--color-border)] py-1.5 text-sm text-[var(--color-text-muted)]">
              Arreter la camera
            </button>
          </>
        ) : (
          <button
            onClick={startCamera}
            className="w-full rounded-md py-2 text-sm font-medium text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Activer la camera
          </button>
        )}
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>

      <form onSubmit={submitManual} className="flex gap-2">
        <input
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          placeholder="Ou coller le lien/code manuellement"
          className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-primary)]">
          Valider
        </button>
      </form>
    </div>
  );
}
