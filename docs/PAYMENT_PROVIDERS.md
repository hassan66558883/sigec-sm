# Fournisseurs de paiement — SIGEC-SM

Ce guide couvre le module de paiement en ligne du portail contribuable (`/portail/factures`) :
comment il fonctionne aujourd'hui sans prestataire réel, et comment brancher un vrai opérateur
(Mobile Money, carte bancaire, passerelle) quand il sera contractualisé.

## 1. Principe : l'application ne dépend d'aucun opérateur

Toute intégration passe par l'interface `PaymentProvider`
(`src/lib/services/payment-provider.ts`) :

```ts
export interface PaymentProvider {
  readonly code: string; // identifiant stocké en base (MobileMoneyTransaction.provider)
  initializePayment(input: PaymentInitInput): Promise<PaymentInitResult>;
  checkPaymentStatus(providerTransactionId: string): Promise<PaymentStatusResult>;
  verifyTransaction(input: { providerTransactionId: string; expectedAmount: number }): Promise<boolean>;
  handleCallback(rawPayload: unknown, headers: Record<string, string>): Promise<PaymentCallbackResult>;
  refundPayment(input: { providerTransactionId: string; amount: number; reason: string }): Promise<PaymentRefundResult>;
}
```

Rien ailleurs dans le code (portail, facturation, reçus, dashboards) ne connaît le nom d'un
opérateur précis. Brancher un opérateur = écrire une classe qui implémente cette interface et
l'enregistrer via `registerProvider()` — aucune autre modification n'est nécessaire.

## 2. Ce qui existe aujourd'hui : `MANUAL`

Le seul adaptateur enregistré par défaut est `MANUAL` (`ManualPaymentProvider`, même fichier).
C'est un adaptateur **honnête, pas un simulateur** :

- `initializePayment()` ne redirige vers rien (`redirectUrl: null`) — le contribuable est informé
  que son paiement attend confirmation.
- `verifyTransaction()` renvoie toujours `false`. C'est délibéré : cela garantit qu'**aucun
  paiement `MANUAL` ne peut jamais devenir `PAID` via le webhook public**
  (`/api/payments/callback/[provider]`), quel que soit le contenu du payload envoyé.
- La confirmation reste un acte humain explicite : un agent autorisé (`mobile_money:confirm`)
  valide la transaction depuis l'admin, exactement comme pour une collecte Mobile Money sur le
  terrain (`confirmMobileMoneyPayment()`, `src/lib/services/mobile-money.ts` — cette fonction gère
  indifféremment les transactions `channel=AGENT` et `channel=ONLINE`, aucune duplication de code).

**Ne jamais modifier `ManualPaymentProvider.verifyTransaction()` pour qu'il renvoie `true`** :
cela romprait la règle absolue « jamais de paiement confirmé sans vérification réelle auprès du
prestataire ».

## 3. Brancher un opérateur réel

### 3.1 Écrire l'adaptateur

Créer `src/lib/services/providers/<nom>.ts` (ex. `airtel-money.ts`) implémentant
`PaymentProvider` :

- `initializePayment()` — appelle l'API du prestataire (initiation de paiement/push USSD), stocke
  sa référence de transaction, renvoie `redirectUrl` si le flux est web (carte bancaire) ou `null`
  si c'est une notification côté téléphone (Mobile Money).
- `checkPaymentStatus()` — interroge activement le statut si le prestataire le permet (polling).
- `verifyTransaction()` — **vérification serveur-à-serveur réelle** (appel API dédié, ou
  validation cryptographique de la réponse déjà reçue) avant de faire confiance à un statut
  "SUCCESS". Ne jamais faire confiance au seul contenu du callback sans cette étape.
- `handleCallback()` — parse le payload du webhook prestataire, **vérifie sa signature** (voir
  §3.3) avant de renvoyer quoi que ce soit ; renvoie `null` (jamais une exception) si la charge
  utile ou la signature est invalide.
- `refundPayment()` — appelle l'API de remboursement du prestataire si elle existe ; sinon renvoie
  `{ providerReference: null }` et laisse le remboursement physique/manuel au processus existant.

### 3.2 Enregistrer l'adaptateur

Dans un point d'entrée serveur (ex. `src/lib/services/payment-provider.ts` ou un fichier
d'initialisation dédié) :

```ts
import { registerProvider } from "@/lib/services/payment-provider";
import { AirtelMoneyProvider } from "@/lib/services/providers/airtel-money";

registerProvider(new AirtelMoneyProvider());
```

Le portail (`PayForm`, `src/app/portail/factures/[id]/pay-form.tsx`) envoie déjà `providerCode` au
serveur — il suffit d'ajouter le nouveau code (`"AIRTEL_MONEY"`, etc.) à son sélecteur pour que le
contribuable puisse le choisir.

### 3.3 Sécurité du webhook — obligatoire avant mise en production

`/api/payments/callback/[provider]` est un endpoint **public, non authentifié par session** (un
vrai prestataire n'a pas de cookie SIGEC-SM). La confiance doit venir exclusivement de
`handleCallback()`/`verifyTransaction()` :

- Vérifier la **signature HMAC** (ou équivalent) fournie par le prestataire dans les en-têtes
  (`headers` est transmis intégralement à `handleCallback()`).
- Vérifier que le **montant** du callback correspond au montant attendu — `handlePaymentCallback()`
  (`src/lib/services/online-payments.ts`) compare déjà `parsed.amount` à `transaction.amount`, mais
  l'adaptateur doit aussi le faire dans `verifyTransaction()` si le prestataire le permet.
- Ne jamais lever d'exception pour une charge utile invalide — renvoyer `null`. Le webhook répond
  toujours `200` côté route (`route.ts`) pour éviter les re-livraisons infinies d'un prestataire
  qui interprète une erreur HTTP comme "à réessayer".

### 3.4 Secrets

Stocker les identifiants d'API (clé, secret, URL sandbox/production) en variables d'environnement,
jamais en dur dans le code :

```ini
# .env — exemple pour un futur operateur
AIRTEL_MONEY_API_KEY="..."
AIRTEL_MONEY_API_SECRET="..."
AIRTEL_MONEY_WEBHOOK_SECRET="..."   # verification de signature du callback
AIRTEL_MONEY_BASE_URL="https://openapiuat.airtel.africa"   # sandbox d'abord
```

### 3.5 Sandbox avant production

Toujours tester en environnement sandbox du prestataire avant de brancher les identifiants de
production (`AIRTEL_MONEY_BASE_URL` pointant sur l'URL sandbox, montants réels faibles). Vérifier
le cycle complet : initiation → callback → `verifyTransaction()` → `PAID` → reçu généré → QR
vérifiable sur `/verify-receipt/<token>`, ainsi que les cas d'échec (montant incohérent, signature
invalide, callback redélivré — voir `tests/online-payments.test.ts` pour les scénarios déjà
couverts par les tests automatisés, à dupliquer pour le nouvel adaptateur).

## 4. Idempotence — ne pas contourner

- `MobileMoneyTransaction.externalReference` est **unique en base** : une tentative de réutiliser
  la référence d'une transaction déjà connue est rejetée et journalisée comme alerte anti-fraude
  (`DOUBLE_PAYMENT`), jamais silencieusement ignorée ni acceptée deux fois.
- `handlePaymentCallback()` court-circuite tout callback pour une transaction déjà `SUCCESS` ou
  `FAILED` (redelivraison webhook) — ne pas retirer cette vérification en écrivant un nouvel
  adaptateur.

## 5. Remboursement

`refundPayment()` (côté service, `src/lib/services/refunds.ts`) appelle
`PaymentProvider.refundPayment()` si le paiement remboursé provient d'un prestataire, puis met à
jour `Payment.status = REMBOURSE` et réduit `ObligationPaiement.paidAmount` en conséquence. Le
paiement original n'est **jamais supprimé** ; motif obligatoire, un seul remboursement par
paiement, action journalisée (`REFUND`).
