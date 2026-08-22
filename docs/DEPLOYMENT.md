# Guide de déploiement — SIGEC-SM (Ubuntu/Linux)

Ce guide couvre l'installation sur un serveur Ubuntu 22.04 LTS (ou équivalent Debian) et la mise en
production derrière un reverse proxy HTTPS, conformément à l'architecture prévue (section 34 du
cahier des charges) : Frontend/Backend Next.js + PostgreSQL + Reverse Proxy.

## 1. Prérequis serveur

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw
```

### Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x attendu
```

### PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE ROLE sigec LOGIN PASSWORD 'CHANGEZ_MOI';"
sudo -u postgres psql -c "CREATE DATABASE sigec_sm OWNER sigec;"
```

Utilisez un rôle **dédié** (`sigec`), jamais le superutilisateur `postgres`, pour l'application.

### Nginx (reverse proxy)

```bash
sudo apt install -y nginx
```

## 2. Déploiement de l'application

```bash
sudo useradd -r -m -d /opt/sigec-sm -s /bin/bash sigec
sudo -u sigec -H bash -c '
  git clone <URL_DU_DEPOT> /opt/sigec-sm/app
  cd /opt/sigec-sm/app
  npm install
'
```

Créer `/opt/sigec-sm/app/.env` (jamais commité — voir `.gitignore`) :

```ini
DATABASE_URL="postgresql://sigec:CHANGEZ_MOI@localhost:5432/sigec_sm?schema=public"
SESSION_SECRET="<sortie de: openssl rand -base64 48>"
ENCRYPTION_KEY="<sortie de: openssl rand -base64 32>"   # chiffrement des champs sensibles (section 32)
APP_BASE_URL="https://sigec.ndjamena.td"   # domaine reel de production
NODE_ENV="production"
```

⚠ Conservez `ENCRYPTION_KEY` avec la même rigueur que `SESSION_SECRET` : la perdre rend illisibles
les champs déjà chiffrés (ex. cause de décès) ; la sauvegarder est donc **une étape du plan de
sauvegarde**, séparément de la base de données (jamais dans le même dépôt que le code).

Si un opérateur de paiement réel est branché (voir [`docs/PAYMENT_PROVIDERS.md`](./PAYMENT_PROVIDERS.md)),
ses identifiants d'API/secrets de webhook viennent s'ajouter au même fichier `.env` — jamais en dur
dans le code, jamais commités.

Migrations, seed initial (une seule fois) et build :

```bash
sudo -u sigec -H bash -c '
  cd /opt/sigec-sm/app
  npx prisma migrate deploy
  npm run db:seed
  npm run build
'
```

⚠ `prisma migrate deploy` (pas `migrate dev`) en production : il applique les migrations existantes
sans en générer de nouvelles ni demander de confirmation interactive.

Notez le mot de passe `SUPER_ADMIN` affiché par `db:seed` — il ne sera plus jamais réaffiché.

## 3. Service systemd

`/etc/systemd/system/sigec-sm.service` :

```ini
[Unit]
Description=SIGEC-SM
After=network.target postgresql.service

[Service]
Type=simple
User=sigec
WorkingDirectory=/opt/sigec-sm/app
EnvironmentFile=/opt/sigec-sm/app/.env
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/sigec-sm/app/.next

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sigec-sm
sudo systemctl status sigec-sm
```

## 4. Reverse proxy Nginx + HTTPS

`/etc/nginx/sites-available/sigec-sm` :

```nginx
server {
    listen 80;
    server_name sigec.ndjamena.td;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sigec-sm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS via Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sigec.ndjamena.td
```

Le middleware `X-Forwarded-For` transmis par Nginx est utilisé par le rate limiting (`src/lib/rate-limit.ts`)
pour identifier l'IP réelle du client — vérifiez qu'aucun autre proxy intermédiaire ne le réécrit.

## 5. Pare-feu

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Le port 3000 (application) et 5432 (PostgreSQL) ne doivent **pas** être exposés publiquement — seul
Nginx (80/443) l'est.

## 6. Mise à jour d'une nouvelle version

```bash
sudo -u sigec -H bash -c '
  cd /opt/sigec-sm/app
  git pull
  npm install
  npx prisma migrate deploy
  npm run build
'
sudo systemctl restart sigec-sm
```

Toujours exécuter une [sauvegarde](./BACKUP.md) avant une migration en production.

## 7. Supervision minimale

```bash
sudo journalctl -u sigec-sm -f       # logs applicatifs
sudo systemctl status sigec-sm       # etat du service
curl -f https://sigec.ndjamena.td/api/health   # verification rapide appli + base
```

L'application expose `/api/health` (public, minimal — statut + disponibilité de la base, aucun
détail d'infrastructure) : à brancher sur le health-check de votre load balancer/reverse proxy, ou
sur un moniteur externe (UptimeRobot, cron + curl + alerte email...). Exemple de vérification cron
simple :

```cron
*/5 * * * * curl -sf https://sigec.ndjamena.td/api/health > /dev/null || echo "SIGEC-SM down" | mail -s "Alerte SIGEC-SM" admin@ndjamena.td
```

Un monitoring plus complet (Prometheus/Grafana, alerting structuré) est hors du périmètre de ce
guide mais recommandé avant une mise en production à grande échelle.
