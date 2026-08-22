# Sauvegarde et restauration — SIGEC-SM

Conforme à la section 33 du cahier des charges : sauvegarde quotidienne de la base de données,
copie hors site, et procédure de restauration testée régulièrement.

## 1. Sauvegarde quotidienne (base de données)

Le script [`scripts/backup.sh`](../scripts/backup.sh) exécute un `pg_dump` compressé et purge les
sauvegardes locales de plus de `BACKUP_RETENTION_DAYS` jours (14 par défaut).

Installation en cron (sur le serveur de production, utilisateur `sigec`) :

```bash
sudo -u sigec crontab -e
```

```cron
# Sauvegarde quotidienne a 2h du matin
0 2 * * * DATABASE_URL="postgresql://sigec:CHANGEZ_MOI@localhost:5432/sigec_sm" \
  BACKUP_DIR="/var/backups/sigec-sm" \
  /opt/sigec-sm/app/scripts/backup.sh >> /var/log/sigec-sm-backup.log 2>&1
```

Ne mettez jamais le mot de passe de production directement dans un fichier versionné : utilisez
`/etc/sigec-sm/backup.env` (mode `600`, propriétaire `sigec`) chargé par la crontab, par exemple :

```cron
0 2 * * * . /etc/sigec-sm/backup.env && /opt/sigec-sm/app/scripts/backup.sh >> /var/log/sigec-sm-backup.log 2>&1
```

## 2. Copie hors site (backup externe)

Une sauvegarde uniquement locale ne protège pas contre une panne matérielle ou une compromission du
serveur. Synchronisez `/var/backups/sigec-sm` vers un stockage distant après chaque sauvegarde
réussie, par exemple avec `rclone` (compatible S3, Backblaze B2, Google Cloud Storage...) :

```bash
# Une seule fois : configurer la destination
rclone config

# A ajouter a la fin de scripts/backup.sh, ou en cron separe apres backup.sh
rclone copy /var/backups/sigec-sm remote:sigec-sm-backups --min-age 1m
```

Conservez au moins 30 jours de sauvegardes hors site, avec une politique de rétention plus longue
que la copie locale.

## 3. Sauvegarde documentaire

Si des documents numérisés sont stockés hors base (registres historiques scannés, section 31), ils
doivent suivre le même cycle de sauvegarde que la base — un simple `rsync` planifié vers le même
stockage distant suffit tant qu'aucun stockage objet dédié n'est mis en place.

## 4. Restauration

Utilisez [`scripts/restore.sh`](../scripts/restore.sh) **sur un environnement de test**, jamais
directement en production sans confirmation explicite :

```bash
./scripts/restore.sh /var/backups/sigec-sm/sigec-sm_20260821_020000.sql.gz \
  "postgresql://sigec:motdepasse@localhost:5432/sigec_sm_test"
```

### Test de restauration périodique

Une sauvegarde jamais restaurée n'est pas une sauvegarde fiable. Planifiez un test mensuel :

1. Créer une base temporaire (`sigec_sm_restore_test`).
2. Restaurer la dernière sauvegarde dedans avec `restore.sh`.
3. Vérifier quelques comptages clés (`SELECT count(*) FROM "Citizen";`, `"Certificate"`, etc.) contre
   la production.
4. Supprimer la base temporaire.

## 5. Disaster recovery — checklist rapide

1. Provisionner un nouveau serveur (voir [DEPLOYMENT.md](./DEPLOYMENT.md)).
2. Restaurer la dernière sauvegarde valide (locale ou hors site) via `restore.sh`.
3. Reconfigurer `.env` (`DATABASE_URL`, `SESSION_SECRET` — **ne pas réutiliser un `SESSION_SECRET`
   compromis**, ce qui invalidera les sessions actives, comportement attendu).
4. `npm run build && systemctl restart sigec-sm`.
5. Vérifier `/admin` (connexion) et `/verify/<token>` (vérification publique) avant de rebasculer le
   DNS/trafic.
