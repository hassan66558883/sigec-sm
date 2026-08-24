# TECHNOTCHAD — Gestion des abonnements et licences (éditeur)

Sous-système commercial de l'éditeur **TECHNOTCHAD**, intégré à l'application SIGEC-SM existante
(mêmes base de données, authentification, RBAC et conventions UI — pas de seconde application).
TECHNOTCHAD commercialise des produits logiciels (SIGEC-SM aujourd'hui, d'autres demain) auprès de
clients ; le premier et seul client actuel est la **Ville de N'Djamena** (Mairie Centrale + 10
arrondissements), abonnée au produit SIGEC-SM.

## Règle de séparation (impérative)

Les données commerciales TECHNOTCHAD (clients, contrats, abonnements, licences) et les données
métier municipales de SIGEC-SM (citoyens, actes d'état civil, finances municipales...) ne doivent
**jamais** être mélangées :

- Toutes les tables commerciales portent le préfixe `Techno*` (`TechnoClient`, `TechnoProduct`,
  `TechnoSubscription`, `TechnoLicense`...) et vivent dans des permissions RBAC dédiées, préfixées
  `technotchad_*`.
- Un administrateur municipal (`SUPER_ADMIN`, `MUNICIPAL_ADMIN`, etc.) n'a **aucune** permission
  `technotchad_*`, même si son rôle utilise le wildcard `["ALL"]`. C'est appliqué explicitement dans
  `prisma/seed.ts` : l'expansion de `"ALL"` exclut tout code de permission commençant par
  `technotchad_`. Un test dédié (`tests/technotchad.test.ts`) vérifie cet état directement contre la
  base de données seedée, pas seulement le code applicatif.
- Symétriquement, un compte purement TECHNOTCHAD (aucune permission municipale) est redirigé depuis
  le tableau de bord municipal (`/admin`) vers `/admin/technotchad` — il ne voit jamais les agrégats
  territoriaux municipaux (`src/app/admin/page.tsx`).
- Aucun filtrage territorial (`recordScopeWhere` / `arrondissementId`) n'est appliqué aux tables
  `Techno*` : ce n'est pas une donnée d'arrondissement, l'isolation se fait uniquement par
  permission de rôle.

## Architecture (réutilisée telle quelle)

- Mêmes conventions Prisma que le reste de l'application : `cuid()`, statuts en `String` documentés
  en commentaire (jamais d'enum Prisma), `createdAt`/`updatedAt`, identifiants lisibles générés par
  entropie (`generateRecordNumber`, `generateLicenseKey` — `src/lib/ids.ts`).
- Services (`src/lib/services/technotchad.ts`) suivent exactement le même patron que
  `services/departments.ts`/`services/roles.ts` : `can()` pour l'autorisation, `ApiError` pour les
  erreurs, `logAudit()` pour la traçabilité.
- Routes API (`src/app/api/technotchad/...`) utilisent `requirePermission()` +
  `handleApiError()`, comme toutes les routes existantes.
- UI intégrée à `/admin` (pas de nouvelle app) : nouvelle section « TECHNOTCHAD » dans
  `SidebarNav`, visible uniquement pour les rôles porteurs d'une permission `technotchad_*:view`.

## Ce qui est livré (phase 1 — socle)

- **Modèle de données central** : `TechnoClient`, `TechnoProduct`, `TechnoProductModule`,
  `TechnoSubscriptionPlan`, `TechnoContract`, `TechnoSubscription`, `TechnoSubscriptionModule`,
  `TechnoSubscriptionUser`, `TechnoSubscriptionSite`, `TechnoLicense`, `TechnoSubscriptionRenewal`
  (migration `prisma/migrations/20260824155735_technotchad_subscriptions`, additive uniquement).
- **RBAC dédié** : 9 modules de permissions `technotchad_*`, 4 rôles système
  (`TECHNOTCHAD_SUPER_ADMIN`, `TECHNOTCHAD_ADMIN`, `TECHNOTCHAD_FINANCE`, `TECHNOTCHAD_SUPPORT`),
  isolation vérifiée par test contre la base réelle.
- **Seed réel** : produit SIGEC-SM (16 modules), client Ville de N'Djamena, plan
  « Gouvernemental », un abonnement actif + une licence + 11 sites (Mairie Centrale +
  10 arrondissements) — idempotent, codes fixes (pas de test data aléatoire en production).
- **Services + API** : création/liste de clients, liste de produits/plans, création d'abonnement
  (génère automatiquement licence + activation des modules du produit), suspension d'abonnement
  (suspend aussi la licence associée), révocation de licence.
- **UI fonctionnelle** (pas des écrans statiques) : `/admin/technotchad` (tableau de bord avec 4
  KPIs réels), `/admin/technotchad/clients` (liste + création), `/admin/technotchad/subscriptions`
  (liste + création + suspension), `/admin/technotchad/licenses` (liste + révocation) — vérifiées
  de bout en bout dans le navigateur (création réelle, licence générée automatiquement, révocation
  fonctionnelle, isolation RBAC confirmée pour les deux sens : SUPER_ADMIN municipal → aucun accès
  TECHNOTCHAD, TECHNOTCHAD_SUPER_ADMIN → aucun accès aux données municipales).
- **Tests** : `tests/technotchad.test.ts` (6 tests) — création client/abonnement/licence,
  génération automatique de licence, suspension en cascade, permissions refusées sans le bon
  `technotchad_*:action`, et les deux tests d'isolation RBAC décrits ci-dessus. Suite complète :
  130 tests passants.

## Ce qui est explicitement différé (hors périmètre de cette phase)

Le cahier des charges complet couvre ~40 tables/fonctions sur 42 sections — l'ampleur est
comparable à un second produit. Restent à livrer, dans des phases suivantes :

- **Facturation TECHNOTCHAD** : `TechnoInvoice`, `TechnoPayment`, `TechnoReceipt` (le modèle de
  données actuel a un champ `amount`/`price` mais aucune émission de facture réelle).
- **Automatisation** : moteur de suspension automatique (J-30/J-7/J/période de grâce), relances,
  renouvellement automatique (le modèle `TechnoSubscriptionRenewal` existe, rien ne l'alimente
  encore).
- **API de validation de licence** (`POST /api/license/validate`) et mode de validation hors-ligne
  pour le produit client.
- **Notifications** (in-app/email/SMS) liées aux échéances et changements de statut.
- **Vérification publique par QR** (`/verify/license/{token}`, `/verify/receipt/{token}`) —
  `TechnoLicense.activationToken` existe dans le schéma, la route publique reste à écrire.
- **Rapports et exports** (PDF/Excel/CSV) sur les données commerciales.
- **Application de `maxUsers`** dans le flux `createUser()` existant, et de `maxSites`/modules
  activés dans les contrôles d'accès applicatifs.
- **Gestion multi-clients avancée** : le modèle est déjà prêt pour plusieurs clients/produits
  (aucune donnée n'est codée en dur pour la Ville de N'Djamena), mais l'UI de gestion de contrats
  (`TechnoContract`) reste minimale (créé automatiquement au seed, pas d'écran de gestion dédié).

Chacun de ces points peut être demandé comme livraison de suite, sur le même socle.
