# Module Plaintes & Doléances — SIGEC-SM

Guide de référence du guichet numérique citoyen de plaintes/doléances : workflow, rôles,
fonctionnalités et limites connues. Le code vit principalement dans
`src/lib/services/complaints.ts` (logique métier), `src/app/portail/plaintes/` (citoyen),
`src/app/admin/complaints/` (agents/superviseurs) et les routes sous `src/app/api/complaints/`
et `src/app/api/portal/complaints/`.

## 1. Cycle de vie d'un dossier (13 états)

```
SUBMITTED → RECEIVED → VERIFYING → NEEDS_INFO ⇄ VERIFYING
                              ↘ REJECTED
                              ↘ ASSIGNED_DEPT → ASSIGNED_AGENT → IN_PROGRESS ⇄ WAITING
                                                                       ↓
                                                                   RESOLVED → VALIDATING → CLOSED
                                                                                    ↓
                                                                              IN_PROGRESS (réouverture)
```

Chaque transition passe par `transitionComplaint()` (ou `assignComplaintToDepartment`/
`assignComplaintToAgent` pour les deux étapes d'affectation), qui vérifie la transition contre
`COMPLAINT_TRANSITIONS` avant d'appliquer le changement — un statut ne peut jamais être "sauté"
depuis le client, quel que soit ce qu'il envoie à l'API. Chaque transition est atomique
(`updateMany({where:{id,status:before.status}})` + vérification du compte affecté) : deux agents
qui traitent le même dossier simultanément ne peuvent jamais l'un écraser le travail de l'autre
silencieusement — le perdant reçoit une erreur 409 explicite.

Le SLA (`dueAt`/`slaHours`) est figé au moment de l'affectation à un agent, selon la priorité
(`SLA_HOURS_BY_PRIORITY`), et n'est **jamais recalculé rétroactivement** — changer la priorité
après affectation ne modifie pas une échéance déjà communiquée au citoyen.

## 2. Rôles et permissions

| Rôle | Permissions `complaints:*` | Rôle organisationnel |
|---|---|---|
| `COMPLAINTS_AGENT` | view, assign, update, resolve, reject, manage_categories, export | Traitement courant |
| `COMPLAINTS_SUPERVISOR` | mêmes permissions | Destinataire réel des escalades niveau superviseur |
| `COMPLAINTS_DIRECTOR` | mêmes permissions | Destinataire des escalades niveau directeur |
| `MAYOR` | view, export (lecture seule) | Vision exécutive globale |

La distinction SUPERVISOR/DIRECTOR est **organisationnelle** (à qui un dossier est escaladé), pas
une restriction RBAC — les trois rôles agent/superviseur/directeur ont le même pouvoir d'action
sur un dossier une fois qu'ils en sont responsables. Le périmètre territorial (`arrondissementIds`)
et la portée globale (`organizationLevel: "CENTRAL"`) restent gérés par le système RBAC général
de l'application (`src/lib/rbac.ts`), pas par ce module.

## 3. Escalade et responsable réel

Les niveaux d'escalade (`ESCALATION_LEVELS` : AGENT → SUPERVISOR → DIRECTOR → CENTRAL_ADMIN) sont
tracés indépendamment du statut du dossier — un dossier peut être escaladé sans changer d'étape
de traitement, l'escalade concerne *qui* en est responsable, pas *où* il en est.

Seul le niveau SUPERVISOR dispose d'une colonne dédiée au schéma (`Complaint.supervisorId`) : en
nommant un utilisateur réel lors de l'escalade (`toUserId`), ce dossier apparaît dans la vue
"Mes plaintes" du compte désigné. DIRECTOR/CENTRAL_ADMIN restent des niveaux purement déclaratifs
(pas de colonne équivalente) — nommer quelqu'un à ces niveaux est accepté mais n'a pas d'effet sur
le tableau de bord d'un compte particulier.

## 4. Détection de doublons et fusion

`findSimilarComplaints()` propose des doublons potentiels sur la fiche d'un dossier : heuristique
volontairement simple (même catégorie + même quartier ou arrondissement + statut encore actif +
créé dans les 30 derniers jours), **pas** de similarité textuelle/ML. Un agent fusionne
explicitement via `mergeComplaints()` — jamais automatique. Le dossier fusionné garde tout son
historique (aucune suppression), il sort simplement des vues actives/KPI du tableau de bord.

## 5. Géolocalisation

Carte interactive (Leaflet + tuiles OpenStreetMap, `src/components/municipal/location-map*.tsx`) —
aucune clé/API payante requise. Le citoyen peut placer un repère en cliquant sur la carte à
l'étape "Localisation" du formulaire ; l'agent le voit en lecture seule sur la fiche. Chargée en
client-only (`next/dynamic({ssr:false})`) car Leaflet accède à `window`/`document` dès son
initialisation — voir le commentaire de `location-map-loader.tsx` pour le détail.

## 6. Pièces jointes

Stockage disque local (`storage/complaints/<id>/`, jamais sous `/public`) — décision prise en
l'absence de tout objet-storage/S3 configuré sur ce projet et pour un déploiement prévu sur un
serveur Linux unique (voir `DEPLOYMENT.md`). Chaque fichier n'est accessible que via une route de
téléchargement authentifiée (propriété du dossier côté citoyen, RBAC + périmètre territorial côté
agent). Limites : JPEG/PNG/WEBP/PDF uniquement, 10 Mo max, 5 pièces jointes par dossier.
`ComplaintAttachment.storagePath` est un champ texte opaque — changer de backend de stockage plus
tard (objet-storage) ne nécessite aucune migration de schéma, seulement une réécriture de
`src/lib/complaint-attachments.ts`.

**Antivirus non implémenté** — aucune infrastructure de scan disponible à ce jour. Si ce module
reçoit un jour des pièces jointes de sources moins fiables qu'un citoyen authentifié, ce point
devra être traité avant mise en production à plus grande échelle.

## 7. Notifications

Canal in-app uniquement (`StaffNotification` côté agents, `Notification` côté citoyens — modèles
déjà utilisés par d'autres modules, aucune infrastructure nouvelle). Événements notifiés : nouveau
dépôt (agents habilités de l'arrondissement), affectation à un agent, escalade vers un superviseur
nommé, message citoyen ↔ agent dans les deux sens, résolution/rejet/clôture.

**SMS et WhatsApp restent hors scope** — aucun fournisseur contractualisé (voir
`src/lib/services/sms.ts`, qui journalise l'intention sans jamais prétendre avoir envoyé un
message). Le brancher un jour ne touche que ce fichier, pas les appelants.

## 8. Export et rapports

`GET /api/complaints/export` (permission `complaints:export`) génère un CSV du périmètre
territorial et de la vue filtrée de l'agent, **sans troncature** — contrairement à certains autres
exports plus anciens de l'application qui plafonnent silencieusement à 100 lignes, un rapport
exécutif ne doit jamais perdre de données sans le signaler.

## 9. Jeu de données de démonstration

```bash
npm run db:seed:demo-complaints
```

Crée 50 plaintes de démonstration (un citoyen par arrondissement, statuts variés couvrant tout le
cycle de vie, quelques évaluations de satisfaction, une escalade vers un superviseur nommé, une
fusion de doublon) en passant systématiquement par les vraies fonctions de service — jamais
d'insertion directe avec un statut choisi à la main, pour que la donnée de démo respecte
exactement les mêmes invariants qu'une vraie utilisation. Idempotent (vérifie la présence du
préfixe `DEMO-COMPLAINT-` avant de créer quoi que ce soit) : relancer la commande ne duplique
jamais les données. Comptes créés : `demo-agent-plaintes@sigec.local` et
`demo-superviseur-plaintes@sigec.local` (mot de passe `Demo1234!`).

Volontairement **séparé** de `prisma/seed.ts` (données de référence, rejoué avant chaque suite de
tests) : mélanger 50 dossiers transactionnels dans le seed automatique aurait pollué chaque
exécution des tests sans rapport avec ce qu'ils vérifient.

## 10. Ce qui reste hors scope

- **SMS/WhatsApp** : bloqué sur l'absence de fournisseur contractualisé.
- **Antivirus sur les pièces jointes** : aucune infrastructure de scan.
- Le reste du cahier des charges initial (workflow, SLA, escalade, doublons, carte, pièces
  jointes, rôles réels, notifications in-app, export) est implémenté et testé.
