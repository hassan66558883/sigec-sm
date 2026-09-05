import { describe, it, expect } from "vitest";
import { enqueuePayment, listQueued, removeQueued, syncQueue, type QueueStorage, type QueuedPayment } from "../src/lib/offline-payment-queue";

// File d'attente de paiements hors ligne (section 22) — logique pure, sans
// DOM/localStorage (le stockage est injecte), verifiee ici avec un
// stockage en memoire fidele a l'interface reelle.
function makeMemoryStorage(): QueueStorage {
  let items: QueuedPayment[] = [];
  return {
    read: () => items,
    write: (next) => {
      items = next;
    },
  };
}

describe("file d'attente de paiements hors ligne", () => {
  it("enqueuePayment attribue un clientRequestId unique et le propage dans le payload envoye plus tard", () => {
    const storage = makeMemoryStorage();
    const item = enqueuePayment(storage, { payerId: "c1", amount: 1000, paymentMethod: "ESPECES" });

    expect(item.clientRequestId).toMatch(/^offline-/);
    expect(item.payload.clientRequestId).toBe(item.clientRequestId);
    expect(listQueued(storage)).toHaveLength(1);

    const second = enqueuePayment(storage, { payerId: "c2", amount: 500, paymentMethod: "ESPECES" });
    expect(second.clientRequestId).not.toBe(item.clientRequestId);
    expect(listQueued(storage)).toHaveLength(2);
  });

  it("syncQueue rejoue dans l'ordre (le plus ancien d'abord) et retire chaque paiement synchronise avec succes", async () => {
    const storage = makeMemoryStorage();
    enqueuePayment(storage, { payerId: "c1", amount: 1000, paymentMethod: "ESPECES" });
    enqueuePayment(storage, { payerId: "c2", amount: 2000, paymentMethod: "ESPECES" });

    const order: string[] = [];
    const result = await syncQueue(storage, async (payload) => {
      order.push(payload.payerId as string);
      return { ok: true, networkError: false };
    });

    expect(order).toEqual(["c1", "c2"]);
    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(listQueued(storage)).toHaveLength(0);
  });

  it("s'arrete au premier echec RESEAU (toujours hors ligne) sans marquer les suivants FAILED", async () => {
    const storage = makeMemoryStorage();
    enqueuePayment(storage, { payerId: "c1", amount: 1000, paymentMethod: "ESPECES" });
    enqueuePayment(storage, { payerId: "c2", amount: 2000, paymentMethod: "ESPECES" });

    const result = await syncQueue(storage, async () => ({ ok: false, networkError: true }));

    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(listQueued(storage)).toHaveLength(2); // rien retire, rien marque
    expect(listQueued(storage).every((i) => i.status === "PENDING")).toBe(true);
  });

  it("une erreur METIER (pas reseau) marque le paiement FAILED, n'est jamais rejouee automatiquement ensuite, et n'empeche pas les suivants", async () => {
    const storage = makeMemoryStorage();
    const bad = enqueuePayment(storage, { payerId: "c1", amount: 1000, paymentMethod: "ESPECES" });
    enqueuePayment(storage, { payerId: "c2", amount: 2000, paymentMethod: "ESPECES" });

    const result = await syncQueue(storage, async (payload) =>
      payload.payerId === bad.payload.payerId
        ? { ok: false, networkError: false, error: "Obligation deja annulee." }
        : { ok: true, networkError: false },
    );

    expect(result).toEqual({ synced: 1, failed: 1 });
    const remaining = listQueued(storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe("FAILED");
    expect(remaining[0].error).toBe("Obligation deja annulee.");

    // Un second appel a syncQueue ne retente jamais un FAILED tout seul.
    const secondSync = await syncQueue(storage, async () => ({ ok: true, networkError: false }));
    expect(secondSync).toEqual({ synced: 0, failed: 0 });
    expect(listQueued(storage)).toHaveLength(1);
  });

  it("removeQueued retire un element precis sans toucher aux autres", () => {
    const storage = makeMemoryStorage();
    const a = enqueuePayment(storage, { payerId: "c1", amount: 1000, paymentMethod: "ESPECES" });
    const b = enqueuePayment(storage, { payerId: "c2", amount: 2000, paymentMethod: "ESPECES" });

    removeQueued(storage, a.clientRequestId);
    const remaining = listQueued(storage);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].clientRequestId).toBe(b.clientRequestId);
  });
});
