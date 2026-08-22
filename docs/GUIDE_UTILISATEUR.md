# Guide utilisateur — SIGEC-SM

## 1. Connexion

- **Agents municipaux** : `/login` avec l'email et le mot de passe fournis par un administrateur.
  Un compte nouvellement créé doit changer son mot de passe à la première connexion (indicateur
  interne `mustResetPwd` — l'application de ce changement obligatoire dans l'interface est prévue
  pour une itération ultérieure ; en attendant, communiquez la consigne à l'agent directement).
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
- Déposer une **plainte** (`Mes plaintes`) avec suivi en temps réel de chaque étape de traitement.
- **Signaler un problème de voirie** (`Signaler (voirie)`) — route, éclairage, caniveau, déchets...

Côté agent, la file `Demandes citoyennes` permet d'approuver (émission automatique du document) ou
de rejeter (motif obligatoire) chaque demande.

## 5. Tableau de bord des recettes (Finances)

`Finances municipales → Tableau de bord recettes` affiche :

- Le **total consolidé**, toujours recalculé à partir des paiements réellement enregistrés (jamais
  une valeur fixe).
- Pour un compte **Mairie Centrale** : la répartition par arrondissement (y compris les recettes
  collectées directement par la Mairie Centrale) et par type de taxe.
- Pour un compte **arrondissement** : uniquement le total et la répartition par type de taxe de son
  propre périmètre — jamais les chiffres des autres arrondissements.

## 6. Statistiques

`Statistiques` (menu principal) affiche une vue consolidée population / état civil / services,
adaptée automatiquement aux permissions de l'utilisateur connecté : chaque section n'apparaît que si
l'agent a le droit de consulter le module correspondant.

## 7. Journal d'audit

`Journal d'audit` (réservé aux rôles habilités) trace chaque action sensible : qui, quoi, quand,
depuis quelle IP, avant/après. Lecture seule — aucun agent, y compris administrateur, ne peut le
modifier depuis l'interface.
