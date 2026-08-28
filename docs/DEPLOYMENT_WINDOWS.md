# Guide de déploiement — SIGEC-SM (application Windows)

Ce guide couvre l'installation de SIGEC-SM comme application de bureau Windows
(`SIGEC-SM.exe`), sur l'architecture prévue : **un poste "serveur central"** (héberge
PostgreSQL et sert l'application) + **des postes "client"** dans chaque arrondissement, qui
s'y connectent sur le réseau local. Voir [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) pour le
déploiement web classique (Linux/Nginx) si vous préférez cette voie à la place.

Le shell Electron (`electron/`) ne réimplémente rien : il empaquette et pilote l'application
Next.js existante, exactement le même code que la version web.

## 1. Installer PostgreSQL sur le poste serveur central

Téléchargez l'installateur PostgreSQL 16 pour Windows :
<https://www.postgresql.org/download/windows/> — exécutez-le, notez le mot de passe du
compte superutilisateur `postgres` choisi pendant l'installation.

Ajoutez le dossier `bin` de PostgreSQL au PATH système si l'installateur ne l'a pas fait
(ex. `C:\Program Files\PostgreSQL\16\bin`), pour que `psql`/`pg_dump` soient utilisables
depuis PowerShell.

## 2. Créer le rôle et la base applicatifs

Depuis une copie du dépôt (poste de build, voir étape 4) :

```powershell
.\scripts\windows\setup-postgres.ps1
```

Demande le mot de passe du superutilisateur `postgres` (celui de l'étape 1) et le nouveau
mot de passe à donner au rôle applicatif `sigec` — jamais stockés, jamais affichés. Crée le
rôle `sigec` et la base `sigec_sm` si absents (idempotent, sans danger à relancer).

## 3. Appliquer les migrations et le seed initial

Toujours depuis le dépôt (nécessite Node.js 20+, installé une seule fois sur le poste de
build) :

```powershell
npm install
$env:DATABASE_URL = "postgresql://sigec:<mot_de_passe>@localhost:5432/sigec_sm"
npx prisma migrate deploy
npm run db:seed
```

`prisma migrate deploy` (jamais `migrate dev`) : applique les migrations existantes sans en
générer de nouvelles ni demander de confirmation interactive. **Notez le mot de passe
`SUPER_ADMIN` affiché par `db:seed`** — il ne sera plus jamais réaffiché.

## 4. Construire l'application Windows

Sur un poste avec accès internet complet (le téléchargement du binaire Electron se fait
depuis GitHub Releases lors du premier `npm install` — prévoyez-le si le poste de build est
derrière un pare-feu restrictif) :

```powershell
npm install
npm run dist:win
```

Produit `release\SIGEC-SM-Setup-<version>.exe` — un installateur NSIS classique (raccourci
bureau, entrée menu Démarrer, désinstallateur). C'est ce fichier qui se copie et s'installe
sur chaque poste (serveur central **et** postes clients — même installateur pour les deux
rôles, voir étape 5).

## 5. Installer sur le poste serveur central

Exécutez `SIGEC-SM-Setup-<version>.exe`, lancez `SIGEC-SM` depuis le raccourci créé. Au
premier lancement, l'écran de configuration s'affiche :

- Choisir **« Ce poste est le serveur central »**
- Renseigner la chaîne de connexion PostgreSQL :
  `postgresql://sigec:<mot_de_passe>@localhost:5432/sigec_sm`
- Port local (3100 par défaut — changez-le uniquement s'il est déjà utilisé par une autre
  application sur ce poste)

L'application démarre son serveur intégré puis affiche l'écran de connexion. Connectez-vous
avec le compte `SUPER_ADMIN` créé à l'étape 3 — un changement de mot de passe est exigé à la
première connexion.

## 6. Configurer l'adresse réseau du serveur central

Sur le poste serveur central, notez son adresse IP locale (`ipconfig` dans une invite de
commandes, ex. `192.168.1.10`). Ce poste doit rester allumé et accessible sur le réseau
pendant les heures d'utilisation des autres postes.

Ouvrez le port choisi (3100 par défaut) dans le pare-feu Windows du poste serveur pour les
connexions entrantes depuis le réseau local uniquement — jamais exposé sur internet sans un
VPN ou un tunnel sécurisé équivalent.

## 7. Installer sur chaque poste d'arrondissement

Exécutez le **même** `SIGEC-SM-Setup-<version>.exe` sur chaque poste client. Au premier
lancement :

- Choisir **« Se connecter à un serveur central »**
- Renseigner l'adresse : `http://192.168.1.10:3100` (l'IP notée à l'étape 6)

Aucune base de données ni build local requis sur ces postes — l'application se contente de
se connecter au serveur central.

## 8. Tester la connexion

Sur un poste client, ouvrez SIGEC-SM et connectez-vous avec un compte agent réel. Si la
fenêtre affiche « Connexion indisponible » en boucle : vérifiez que le poste serveur central
est allumé, que l'adresse/port renseignés sont corrects, et que le pare-feu du poste serveur
autorise la connexion entrante (étape 6).

## 9. Sauvegarde et restauration

Sur le poste serveur central :

```powershell
.\scripts\windows\backup.ps1
```

Sauvegarde par défaut dans `C:\SIGEC-SM\backups\`, rétention 14 jours (paramétrable — voir
l'aide intégrée du script : `Get-Help .\scripts\windows\backup.ps1 -Full`). Planifiez son
exécution quotidienne via le **Planificateur de tâches Windows** (Créer une tâche de base →
déclencheur quotidien → action « Démarrer un programme » → `powershell.exe` avec l'argument
`-File "C:\chemin\vers\backup.ps1"`).

Restauration (à tester régulièrement sur un environnement de vérification, **jamais**
directement en production sauf sinistre confirmé) :

```powershell
.\scripts\windows\restore.ps1 -BackupFile "C:\SIGEC-SM\backups\sigec-sm_<date>.sql.gz" -TargetDatabaseUrl "postgresql://sigec:<mot_de_passe>@localhost:5432/sigec_sm_test"
```

⚠ Conservez une copie de `SESSION_SECRET`/`ENCRYPTION_KEY`/`CRON_SECRET` séparément de la
base — ces valeurs sont générées automatiquement au premier lancement en rôle "serveur
central" (voir `electron/config-store.js`) et stockées dans
`%APPDATA%\sigec-sm\config.json`. Les perdre invalide toutes les sessions actives et rend
illisibles les champs déjà chiffrés (téléphone des citoyens, cause de décès) — sauvegardez
ce fichier au même titre que la base de données.

## 10. Mettre à jour une nouvelle version

Reconstruisez un nouvel installateur (étape 4) avec le code à jour, puis réinstallez-le sur
chaque poste (serveur central d'abord, puis les postes clients) — l'installateur NSIS
remplace la version précédente sans perdre la configuration (`config.json` reste dans
`%APPDATA%`, propre à chaque poste). Si la nouvelle version inclut des migrations Prisma,
appliquez `npx prisma migrate deploy` (étape 3) **avant** de relancer l'application sur le
serveur central.

Exécutez toujours une [sauvegarde](#9-sauvegarde-et-restauration) avant une mise à jour en
production.

## Limites connues de cette phase

Cette architecture est un **client léger** : les postes d'arrondissement ne fonctionnent que
si le serveur central est joignable sur le réseau. Une coupure réseau bloque la saisie de
nouvelles données (naissances, paiements...) sur les postes clients jusqu'au rétablissement
de la connexion — comportement voulu, pas un bug : il garantit qu'aucun acte d'état civil ne
peut jamais être enregistré en double. Un mode hors-ligne avec écriture locale et
synchronisation différée est un chantier distinct, plus important, non couvert ici.
