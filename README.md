# SIGEC-SM — Ville de N'Djamena

Système Intégré de Gestion de l'État Civil et des Services Municipaux. Plateforme unique,
centralisée techniquement et décentralisée fonctionnellement : une Mairie Centrale supervise
10 arrondissements municipaux, chacun avec son propre périmètre de données.

## Stack technique

- **Next.js 16** (App Router, Turbopack en dev / Webpack en build) + TypeScript
- **PostgreSQL** via **Prisma 7** (driver adapter `@prisma/adapter-pg`, pas de connexion directe dans le schéma)
- **Tailwind CSS v4**
- Authentification par session JWT (cookies `httpOnly`) — deux realms séparés (agents vs citoyens)

## Architecture des données

```
Ville (City)
  └─ Arrondissement (10, fixe pour N'Djamena)
       └─ Quartier
            └─ Secteur/Zone
```

Chaque table "de terrain" (citoyens, actes, certificats, demandes...) porte un `arrondissementId`
obligatoire et est filtrée côté **serveur** via `recordScopeWhere()` (`src/lib/rbac.ts`) — jamais
seulement masquée côté client. Un utilisateur `organizationLevel = CENTRAL` (Mairie Centrale) voit
tout ; un utilisateur `ARRONDISSEMENT` ne voit que ses arrondissements rattachés
(`UserArrondissement`). Cette convention est prévue pour être réutilisée telle quelle par tous les
modules futurs (finances, foncier, plaintes...).

## Réalms d'authentification

| Réalm | Cookie | Entrée | Modèle |
|---|---|---|---|
| Agents municipaux | `sigec_session` | `/login` → `/admin` | `User` (RBAC : `Role`/`Permission`) |
| Citoyens | `sigec_citizen_session` | `/portail/login` → `/portail` | `CitizenAccount` (lié à un `Citizen` existant) |

Un compte citoyen se crée par **rattachement** à un dossier `Citizen` déjà existant (numéro unique +
nom de famille), jamais par auto-déclaration libre — le dossier fait foi, créé par un agent lors d'un
acte réel (ex. déclaration de naissance).

## État d'avancement (roadmap section 37 du cahier des charges)

- ✅ **Phase 1 — Fondation** : auth, RBAC granulaire (module:action), structure territoriale,
  services centraux (`Department`), audit log, dashboard central/arrondissement.
- ✅ **Phase 2 — État civil** : citoyens, ménages/familles, naissances, reconnaissances, mariages
  (+ régimes matrimoniaux), divorces, décès, moteur de certificats générique avec vérification
  publique par QR/lien (`/verify/[token]`), sans authentification, sans exposer de données
  personnelles inutiles.
- ✅ **Phase 3 — Portail citoyen** : compte citoyen, demandes de copies d'actes, file de traitement
  côté agents, émission automatique du certificat à l'approbation, notifications in-app.
- ✅ **Phase 4 — Foncier et urbanisme** : parcelles, lotissements, titres fonciers, workflow permis
  de construire/démolition (soumission → instruction → contrôle → décision → document officiel),
  réutilisant le même moteur de certificats/QR que l'état civil.
- ✅ **Phase 5 — Finances municipales** : commerçants/patentes, marchés et emplacements, paiements
  avec `arrondissementId` obligatoire (`NULL` seulement pour une recette Mairie Centrale), tableau
  de bord des recettes consolidé (total ville, répartition par arrondissement, par type de taxe) —
  **calculé dynamiquement par agrégation SQL, jamais codé en dur**.
- ✅ **Phase 6 — Services municipaux** : registre des associations/ONG, guichet numérique des
  plaintes (workflow à 7 états Nouveau→Reçu→Affecté→En traitement→En attente→Résolu→Clôturé, avec
  historique horodaté visible par le citoyen dans son portail), signalement citoyen des problèmes
  de voirie/infrastructures.
- ✅ **Phase 7 — Analytics** : statistiques population (total, par sexe, par situation
  matrimoniale, par arrondissement), état civil (naissances/mariages/divorces/décès/reconnaissances/
  certificats, total + année en cours), et services (demandes/plaintes/dossiers d'urbanisme/parcelles
  par statut) — `/admin/analytics`, chaque section n'apparaît que si l'utilisateur a la permission de
  vue du module correspondant (pas de nouveau module "analytics" séparé, RBAC réutilisé tel quel).
- 🟡 **Phase 8 — Sécurité et production** (partielle, voir ci-dessous) : en-têtes de sécurité,
  changement de mot de passe obligatoire réellement appliqué, guides de déploiement/sauvegarde,
  **suite de tests automatisés** (32 tests, Vitest, contre une base PostgreSQL de test dédiée)
  couvrant les fonctions critiques listées section 38 : création citoyen, naissance → validation →
  certificat → vérification QR → révocation, mariage → divorce (mise à jour de la situation
  matrimoniale), décès, permissions, isolation entre arrondissements, paiements/recettes, audit, et
  les cas d'erreur associés. Restent : chiffrement des champs sensibles, monitoring applicatif.

Les Phases 1 à 7 ont chacune été vérifiées de bout en bout dans le navigateur (pas seulement
compilées) : création de données réelles, isolation territoriale testée par accès direct à
l'API/URL hors périmètre (403/404 confirmés), et workflows complets (ex. naissance → validation →
émission du certificat → vérification publique → révocation) rejoués intégralement.

## Documentation complémentaire

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — installation Ubuntu/Linux, service systemd, Nginx + HTTPS.
- [`docs/BACKUP.md`](docs/BACKUP.md) — sauvegarde quotidienne, copie hors site, restauration, disaster recovery.
- [`docs/GUIDE_UTILISATEUR.md`](docs/GUIDE_UTILISATEUR.md) — prise en main par rôle (agents, citoyens).
- [`scripts/backup.sh`](scripts/backup.sh) / [`scripts/restore.sh`](scripts/restore.sh) — scripts exécutables.

### Notes importantes

- Les **10 arrondissements** sont seedés avec des noms **placeholder** ("Arrondissement 1"...10) —
  à renommer via `/admin/arrondissements` une fois les dénominations officielles confirmées par la
  mairie (règle 39 : aucune donnée juridique/officielle n'est inventée).
- Les **régimes matrimoniaux** et **types de taxes** (montants) seedés sont explicitement marqués
  "(à valider)" pour la même raison.
- Aucune API de paiement réelle n'est branchée (section 25) : les paiements sont enregistrés
  manuellement par un agent (espèces, mobile money, virement) avec émission d'une quittance ; le
  suivi des impayés (factures émises non réglées) nécessite un futur module de facturation.

## Démarrage local

1. **Base de données** — une instance PostgreSQL accessible. En dev, un rôle dédié `sigec` a été
   utilisé sur l'instance locale existante plutôt que le superutilisateur ; adaptez `DATABASE_URL`
   dans `.env` à votre environnement (voir `.env.example`).
2. Installer les dépendances :
   ```bash
   npm install
   ```
3. Appliquer les migrations et peupler les données de référence (10 arrondissements, services
   centraux, permissions, rôles système, types de certificats, régimes matrimoniaux, compte
   SUPER_ADMIN initial) :
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```
   Le mot de passe du compte `SUPER_ADMIN` créé est affiché **une seule fois** dans la sortie de la
   commande (`mustResetPwd` est activé — à changer dès la première connexion). Pour un mot de passe
   déterministe (CI, démo), définissez `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` avant de lancer.
4. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```
   - Espace agents : `http://localhost:3000/login`
   - Portail citoyen : `http://localhost:3000/portail/login`

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production (Webpack — Turbopack désactivé pour la stabilité du build) |
| `npm run start` | Démarre le build de production |
| `npm run db:seed` | Rejoue le seed (idempotent — `upsert` sur les référentiels) |
| `npm run db:studio` | Prisma Studio (explorateur de données) |
| `npm run lint` | ESLint |
| `npm test` | Suite de tests automatisés (Vitest) |

## Tests automatisés

Les tests tournent contre une base PostgreSQL **dédiée** (`sigec_sm_test`, jamais la base de
dev/prod), configurée dans `.env.test` (à créer, non commité — voir `DATABASE_URL` dans
`.env.example` pour le format). Créez la base une fois :

```sql
CREATE DATABASE sigec_sm_test OWNER <votre_role>;
```

Puis lancez :

```bash
npm test
```

Le `globalSetup` (`tests/global-setup.ts`) applique automatiquement les migrations et rejoue le
seed réel à chaque exécution (idempotent) — aucune étape manuelle supplémentaire. Les fixtures
(`tests/helpers/fixtures.ts`) créent des utilisateurs/citoyens/arrondissements réels en base plutôt
que des mocks : les tests exercent les vraies contraintes Prisma/PostgreSQL (unicité, FK), pas une
simulation.

## Sécurité (implémenté à ce stade)

- Mots de passe hashés (`bcryptjs`, 12 rounds)
- Sessions JWT `httpOnly`, `sameSite=lax`, `secure` en production
- **Changement de mot de passe obligatoire réellement appliqué** (`mustResetPwd`) : vérifié dans
  `proxy.ts` sur chaque requête (y compris navigation côté client via `Link`), pas seulement au
  premier chargement — voir le commentaire dans `src/proxy.ts` pour le piège évité (le blocage
  placé uniquement dans un layout Server Component peut être contourné par le cache de segment RSC
  de Next.js lors d'une navigation cliente).
- Rate limiting basique sur les endpoints de connexion et d'inscription (agents + citoyens)
- RBAC appliqué au niveau service/API (pas seulement l'UI) — vérifié par tests manuels
  d'accès direct (403/404 confirmés hors périmètre)
- Isolation territoriale appliquée au niveau requête SQL (`recordScopeWhere`), jamais en filtrant
  après coup côté client
- Audit log non modifiable par les agents (écriture uniquement via `logAudit()` côté serveur)
- Validation de révocation avec motif obligatoire (pas de `window.prompt()` natif)
- En-têtes de sécurité HTTP (`next.config.mjs`) : `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
- Protection CSRF : cookies `sameSite=lax` + endpoints exigeant `Content-Type: application/json`
  (un formulaire HTML cross-site classique ne peut ni fixer ce header ni faire suivre le cookie sur
  une requête POST cross-origin) — pas de jeton CSRF distinct à ce stade
- **Chiffrement applicatif des champs sensibles** (`src/lib/encryption.ts`, AES-256-GCM) — appliqué
  à `DeathRecord.cause` (donnée médicale, jamais recherchée/filtrée). Vérifié par requête SQL brute
  directe : la valeur stockée n'est jamais le texte en clair. Convention documentée dans le fichier
  pour étendre à d'autres champs *à condition* qu'ils ne soient ni recherchés (`contains`) ni
  contraints par une unicité — sinon le chiffrement (IV aléatoire à chaque appel) casse la requête.
- **Endpoint de supervision** `/api/health` (public, minimal : disponibilité appli + base) — à
  brancher sur un load balancer ou un outil de monitoring externe (voir `docs/DEPLOYMENT.md`).
- **Suite de tests automatisés** (`npm test`, Vitest, 37 tests) contre une base PostgreSQL de test
  dédiée — voir la section [Tests automatisés](#tests-automatisés) ci-dessus.

Restent à couvrir pour la Phase 8 : chiffrement étendu à d'autres champs sensibles au choix (ex.
`Citizen.phone`), sauvegardes automatisées *testées en conditions réelles* (voir
[`docs/BACKUP.md`](docs/BACKUP.md) pour la procédure, à exécuter au moins une fois avant mise en
production), et un monitoring applicatif complet (métriques, alerting — `/api/health` n'en est que
la brique de base).
