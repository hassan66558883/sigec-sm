// File d'attente de paiements hors ligne (module collecte terrain, section
// 22). Le stockage est injecte (interface QueueStorage) plutot que d'appeler
// localStorage directement partout : ca permet de tester toute la logique
// de mise en file/rejeu sous Node (pas de DOM necessaire) et garde la
// dependance au navigateur dans un seul petit adaptateur.
//
// L'idempotence reelle vit cote serveur (Payment.clientRequestId, voir
// recordPayment() dans services/payments.ts) — ce module ne fait que
// garantir qu'un meme clientRequestId est envoye a chaque rejeu, jamais
// qu'un nouveau paiement est cree a chaque tentative.
export type QueuedPayment = {
  clientRequestId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: "PENDING" | "FAILED";
  error?: string;
};

export interface QueueStorage {
  read(): QueuedPayment[];
  write(items: QueuedPayment[]): void;
}

const STORAGE_KEY = "sigec-offline-payment-queue";

// Adaptateur reel (navigateur). Toute erreur d'acces (navigation privee,
// quota depasse) est avalee : la file est alors perdue au rechargement,
// mais l'interface reste utilisable plutot que de planter — un agent qui
// perd sa file locale reste moins grave qu'une page qui ne repond plus.
export function createLocalStorageQueue(): QueueStorage {
  return {
    read() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as QueuedPayment[]) : [];
      } catch {
        return [];
      }
    },
    write(items) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // stockage indisponible — voir commentaire ci-dessus.
      }
    },
  };
}

function generateClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `offline-${crypto.randomUUID()}`;
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueuePayment(storage: QueueStorage, payload: Record<string, unknown>): QueuedPayment {
  const clientRequestId = generateClientRequestId();
  const item: QueuedPayment = {
    clientRequestId,
    payload: { ...payload, clientRequestId },
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };
  storage.write([...storage.read(), item]);
  return item;
}

export function listQueued(storage: QueueStorage): QueuedPayment[] {
  return storage.read();
}

export function removeQueued(storage: QueueStorage, clientRequestId: string): void {
  storage.write(storage.read().filter((i) => i.clientRequestId !== clientRequestId));
}

function markFailed(storage: QueueStorage, clientRequestId: string, error: string): void {
  storage.write(storage.read().map((i) => (i.clientRequestId === clientRequestId ? { ...i, status: "FAILED" as const, error } : i)));
}

export type SyncPostResult = { ok: boolean; networkError: boolean; error?: string };

// Rejoue chaque paiement en attente, DANS L'ORDRE (le plus ancien
// d'abord — un agent peut avoir collecte plusieurs paiements hors ligne
// dans une sequence qui compte, ex. reservations de meme emplacement).
// S'arrete au premier echec RESEAU (toujours hors ligne, inutile de
// continuer) ; une erreur METIER (4xx reel : obligation deja annulee
// entre-temps, etc.) est marquee FAILED et n'est PAS rejouee
// automatiquement — necessite une decision humaine, jamais silencieuse.
export async function syncQueue(storage: QueueStorage, post: (payload: Record<string, unknown>) => Promise<SyncPostResult>): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const item of storage.read()) {
    if (item.status === "FAILED") continue;
    const result = await post(item.payload);
    if (result.ok) {
      removeQueued(storage, item.clientRequestId);
      synced++;
    } else if (result.networkError) {
      break;
    } else {
      markFailed(storage, item.clientRequestId, result.error ?? "Echec inconnu.");
      failed++;
    }
  }
  return { synced, failed };
}
