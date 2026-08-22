// Architecture de paiement independante du fournisseur (module paiement en
// ligne, section 8). Aucun operateur (Mobile Money, carte bancaire...) n'est
// code en dur ailleurs dans l'application : tout passage par un prestataire
// externe se fait exclusivement via cette interface. Brancher un operateur
// reel = implementer PaymentProvider et l'enregistrer dans registerProvider(),
// sans toucher au portail, a la facturation ni aux recus.
//
// IMPORTANT (regle absolue) : aucune implementation ne doit jamais renvoyer
// un succes simule. En l'absence de vrai prestataire contractualise,
// ManualPaymentProvider est le seul adaptateur enregistre par defaut : il
// laisse le paiement PENDING et exige une confirmation explicite (agent
// autorise aujourd'hui, webhook signe d'un vrai prestataire demain — voir
// services/online-payments.ts et services/mobile-money.ts).

export type PaymentInitInput = {
  internalReference: string;
  amount: number;
  currency: string;
  phoneNumber?: string | null;
  payerName: string;
  description: string;
};

export type PaymentInitResult = {
  providerTransactionId: string | null;
  redirectUrl: string | null;
  raw?: unknown;
};

export type PaymentStatusResult = {
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  raw?: unknown;
};

export type PaymentCallbackResult = {
  internalReference: string;
  providerTransactionId: string;
  status: "SUCCESS" | "FAILED";
  amount: number;
} | null; // null = charge utile/signature invalide (webhook ignore, pas d'exception)

export type PaymentRefundResult = { providerReference: string | null };

export interface PaymentProvider {
  readonly code: string; // stocke dans MobileMoneyTransaction.provider
  initializePayment(input: PaymentInitInput): Promise<PaymentInitResult>;
  checkPaymentStatus(providerTransactionId: string): Promise<PaymentStatusResult>;
  verifyTransaction(input: { providerTransactionId: string; expectedAmount: number }): Promise<boolean>;
  handleCallback(rawPayload: unknown, headers: Record<string, string>): Promise<PaymentCallbackResult>;
  refundPayment(input: { providerTransactionId: string; amount: number; reason: string }): Promise<PaymentRefundResult>;
}

// Adaptateur par defaut : aucune passerelle reelle branchee. Utilise en
// sandbox/developpement et pour toute collecte confirmee manuellement par un
// agent (flux existant, voir services/mobile-money.ts). Ne verifie ni ne
// confirme jamais automatiquement — c'est le sens meme de cet adaptateur.
class ManualPaymentProvider implements PaymentProvider {
  readonly code = "MANUAL";

  async initializePayment(): Promise<PaymentInitResult> {
    return { providerTransactionId: null, redirectUrl: null };
  }

  async checkPaymentStatus(): Promise<PaymentStatusResult> {
    return { status: "PENDING" };
  }

  async verifyTransaction(): Promise<boolean> {
    // Aucune verification automatique possible sans prestataire reel :
    // la confirmation reste un acte humain explicite (agent ou test sandbox).
    return false;
  }

  // Permet neanmoins de tester le pipeline de bout en bout en sandbox : si un
  // payload structure est fourni explicitement (ex. script de test), on le
  // relaie tel quel. Un payload absent/mal forme renvoie null (webhook ignore).
  async handleCallback(rawPayload: unknown): Promise<PaymentCallbackResult> {
    if (!rawPayload || typeof rawPayload !== "object") return null;
    const p = rawPayload as Record<string, unknown>;
    if (
      typeof p.internalReference !== "string" ||
      typeof p.providerTransactionId !== "string" ||
      (p.status !== "SUCCESS" && p.status !== "FAILED") ||
      typeof p.amount !== "number"
    ) {
      return null;
    }
    return { internalReference: p.internalReference, providerTransactionId: p.providerTransactionId, status: p.status, amount: p.amount };
  }

  async refundPayment(): Promise<PaymentRefundResult> {
    // Aucune passerelle a contacter : le remboursement physique/manuel reste
    // a la charge de l'agent, cette fonction se contente de ne rien casser.
    return { providerReference: null };
  }
}

const providers = new Map<string, PaymentProvider>([["MANUAL", new ManualPaymentProvider()]]);

export function registerProvider(provider: PaymentProvider) {
  providers.set(provider.code, provider);
}

export function getPaymentProvider(code: string): PaymentProvider {
  const provider = providers.get(code);
  if (!provider) throw new Error(`Fournisseur de paiement inconnu : ${code}`);
  return provider;
}

export function listProviderCodes(): string[] {
  return [...providers.keys()];
}
