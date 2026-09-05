# Guide utilisateur — SIGEC-SM

## 1. Connexion

- **Agents municipaux** : `/login` avec l'email et le mot de passe fournis par un administrateur.
  Un compte nouvellement créé doit changer son mot de passe à la première connexion — l'application
  bloque réellement l'accès à tout le reste de l'espace agent (`mustResetPwd`, vérifié à chaque
  requête, y compris en navigation côté client) tant que ce changement n'a pas été fait.
- **Citoyens** : `/portail/login`. La création de compte (`/portail/register`) nécessite le
  **numéro de dossier citoyen** (visible sur tout certificat délivré, format `CIT-AAAA-XXXXXXXX`) et
  le nom de famille exact du dossier — un compte ne peut pas être créé sans dossier citoyen
  préexistant, créé par un agent lors d'un acte réel (naissance, etc.).

## 2. Périmètre et rôles

Chaque agent appartient soit à la **Mairie Centrale** (vision des 10 arrondissements), soit à un ou
plusieurs **arrondissements** précis (vision limitée à ceux-ci). Ce périmètre est indépendant des
permissions accordées par le rôle — les deux se combinent : un rôle définit *ce qu'un agent peut
faire*, le périmètre définit *sur quelles données*.

Un administrateur central (`Administrateur municipal` ou `Super Administrateur`) crée les comptes
via **Utilisateurs → + Nouvel utilisateur**, en choisissant le niveau organisationnel, le(s) rôle(s)
et, si applicable, le(s) arrondissement(s) de rattachement.

## 3. Workflow type — un acte d'état civil

Exemple avec une naissance (le même schéma s'applique aux reconnaissances, mariages, divorces,
décès, et aux permis d'urbanisme) :

1. **Déclarer** (Agent d'état civil) : `Naissances → + Déclarer une naissance`. Crée le dossier
   citoyen de l'enfant et l'acte, statut *Déclarée*.
2. **Valider/Enregistrer** (Chef de service ou Responsable d'arrondissement) : bouton *Valider* sur
   la fiche. Statut passe à *Enregistrée* — l'acte est désormais officiel.
3. **Émettre le certificat** : uniquement possible une fois l'acte enregistré. Génère un document
   avec numéro unique et QR code de vérification publique.
4. **Vérification publique** : quiconque scanne le QR code (ou ouvre le lien) arrive sur
   `/verify/<token>`, sans compte, et voit uniquement le statut (Valide/Révoqué), le type, le
   numéro et la date — jamais de données personnelles.
5. **Révocation** (si nécessaire) : un motif est obligatoire ; la page de vérification publique
   reflète immédiatement le changement de statut.

## 4. Portail citoyen

Un citoyen connecté peut :

- Consulter son tableau de bord (demandes en cours, notifications).
- Demander une **copie de son propre acte** (naissance ou mariage) — la demande est vérifiée côté
  serveur pour s'assurer qu'elle concerne bien son propre dossier.
- Déposer une **plainte** (`Mes plaintes`) avec suivi en temps réel de chaque étape de traitement,
  localisation sur carte, pièces jointes et messagerie avec l'agent (détail complet du workflow,
  des rôles et des escalades dans [`docs/COMPLAINTS_MODULE.md`](./COMPLAINTS_MODULE.md)).
- **Signaler un problème de voirie** (`Signaler (voirie)`) — route, éclairage, caniveau, déchets...

Côté agent, la file `Demandes citoyennes` permet d'approuver (émission automatique du document) ou
de rejeter (motif obligatoire) chaque demande.

## 5. Recettes municipales — contribuables, marchés, tarifs, paiements

Module couvrant le recensement des contribuables et le recouvrement des taxes/redevances
municipales (patentes, taxes de marché, occupation du domaine public).

### 5.1 Recensement

- **Contribuables → + Nouveau contribuable** : crée ou identifie un `Citizen` comme contribuable
  (numéro de dossier unique, réutilisé pour l'état civil et les recettes — pas de doublon).
- **Boutiques & commerçants** : rattache une activité économique à un contribuable, avec
  localisation (arrondissement/quartier).
- **Marchés & emplacements** : structure `Marché → Emplacement (étal, kiosque, boutique...)`. Un
  emplacement ne peut avoir qu'**un seul occupant actif à la fois** — l'application l'empêche.

### 5.2 Tarification

`Tarification` (réservé aux rôles habilités, ex. Administrateur municipal) : consulter, créer ou
réviser un tarif. **Une révision ne modifie jamais un tarif existant** : elle clôture l'ancien
(date de fin renseignée) et crée une nouvelle ligne — une facture déjà émise garde pour toujours le
tarif qui était applicable au moment de son émission, même après une révision ultérieure. Chaque
tarif porte une référence légale (texte/décision officielle) — aucun montant n'est saisi sans
cette référence.

### 5.3 Obligations et paiements

- **Obligations** : la somme due, générée à partir du tarif applicable (jamais un montant saisi
  librement) pour un contribuable/emplacement et une période donnée.
- **Encaissement** (agent collecteur, guichet ou terrain) : espèces, virement, ou Mobile Money.
  Un paiement Mobile Money reste **en attente** tant que la réception n'a pas été confirmée — il
  n'y a jamais de reçu ni d'imputation sur l'obligation avant cette confirmation explicite
  (`Mobile Money → Confirmer`, réservé aux agents autorisés).
- **Caisses** : un agent collecteur ouvre une caisse en début de tournée et la clôture en déclarant
  le montant réellement en sa possession — tout écart avec le montant attendu (calculé) déclenche
  automatiquement une alerte anti-fraude.
- **Reçu** : généré automatiquement dès qu'un paiement est confirmé (jamais avant), avec QR code de
  vérification publique — même principe que les certificats d'état civil.

### 5.4 Contrôle anti-fraude

`Contrôle anti-fraude` (réservé aux superviseurs) liste les alertes générées automatiquement :
annulations excessives par un agent, écart de caisse, collecte hors zone affectée, volume de
transactions suspect, paiement hors horaires habituels, tentative de double paiement. Chaque alerte
doit être **résolue avec une note explicative** (résolue ou ignorée) — jamais supprimée
silencieusement.

### 5.5 Remboursement

Un paiement déjà confirmé (`PAID`) peut être remboursé (`Recettes municipales → Paiements →
Rembourser`, réservé aux rôles habilités) : motif obligatoire, un seul remboursement possible par
paiement, le paiement original reste visible avec son historique complet (jamais supprimé).

## 6. Portail contribuable — factures et paiement en ligne

Un contribuable connecté à `/portail` (même compte que pour l'état civil) trouve deux entrées
supplémentaires dans son menu :

- **Mes factures** : liste de ses obligations avec le solde restant. Cliquer sur une facture ouvre
  son détail (montant, pénalité/remise éventuelle, échéance) et, si un solde reste dû, un bouton
  **Payer**.
- **Payer en ligne** : le contribuable saisit son numéro Mobile Money et confirme. Le paiement est
  immédiatement créé **en attente** — le message affiché le précise explicitement, aucun succès
  n'est jamais simulé. Le reçu apparaît automatiquement dans **Mes paiements** dès que le paiement
  est réellement confirmé côté municipalité (voir §5.3 et
  [`docs/PAYMENT_PROVIDERS.md`](./PAYMENT_PROVIDERS.md) pour le fonctionnement exact).
- **Mes paiements** : historique complet, y compris les paiements encore en attente, avec lien vers
  le reçu (et son QR) une fois confirmé.

Le tableau de bord du portail (`/portail`) affiche en tête le solde total à payer et le nombre de
factures en attente/échues.

Des rappels automatiques sont envoyés (notification in-app, et SMS si un fournisseur est configuré) :
7 et 1 jour avant l'échéance, puis le lendemain de l'échéance (la facture passe alors "En retard")
et 7 jours après si elle reste impayée. Chaque rappel n'est envoyé qu'une seule fois par facture.

## 7. Tableau de bord des recettes (Finances)

`Finances municipales → Tableau de bord recettes` affiche :

- Le **total consolidé**, toujours recalculé à partir des paiements réellement enregistrés (jamais
  une valeur fixe).
- Pour un compte **Mairie Centrale** : la répartition par arrondissement (y compris les recettes
  collectées directement par la Mairie Centrale) et par type de taxe.
- Pour un compte **arrondissement** : uniquement le total et la répartition par type de taxe de son
  propre périmètre — jamais les chiffres des autres arrondissements.
- Le **taux de recouvrement** (montant réellement payé / montant total dû sur les obligations non
  annulées) et la répartition **paiements en ligne / paiements physiques**.

## 8. Rapports

`Rapports` (menu principal, accès filtré par permission d'export de chaque module) regroupe tous
les exports CSV, toujours bornés au périmètre territorial de l'utilisateur connecté : recettes
(avec filtres date/arrondissement/agent/mode de paiement/statut), impayés, annulations, anomalies
anti-fraude, transactions Mobile Money, reçus, journal d'audit, ainsi que les rapports par module
d'état civil (citoyens, ménages, naissances, mariages, divorces, décès) et le **rapport statistique
par arrondissement** (une ligne par arrondissement : population, état civil, recettes, impayés —
utile pour comparer les 10 arrondissements d'un coup d'œil).

## 9. Statistiques

`Statistiques` (menu principal) affiche une vue consolidée population / état civil / services,
adaptée automatiquement aux permissions de l'utilisateur connecté : chaque section n'apparaît que si
l'agent a le droit de consulter le module correspondant.

## 10. Journal d'audit

`Journal d'audit` (réservé aux rôles habilités) trace chaque action sensible : qui, quoi, quand,
depuis quelle IP, avant/après. Lecture seule — aucun agent, y compris administrateur, ne peut le
modifier depuis l'interface.
