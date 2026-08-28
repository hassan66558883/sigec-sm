<#
.SYNOPSIS
  Sauvegarde de la base PostgreSQL de SIGEC-SM (equivalent Windows de
  scripts/backup.sh, meme logique : pg_dump + compression + purge par
  retention). A executer sur le poste "serveur central" (voir
  docs/DEPLOYMENT_WINDOWS.md), manuellement ou via le Planificateur de
  taches Windows pour une sauvegarde quotidienne automatique.

.PARAMETER DatabaseUrl
  Chaine de connexion PostgreSQL. Par defaut, lue depuis la variable
  d'environnement DATABASE_URL (celle deja configuree pour l'application).

.PARAMETER BackupDir
  Dossier de sauvegarde locale. Defaut : C:\SIGEC-SM\backups

.PARAMETER RetentionDays
  Nombre de jours de sauvegardes locales a conserver. Defaut : 14.

.EXAMPLE
  .\backup.ps1
  .\backup.ps1 -BackupDir "D:\Sauvegardes\SIGEC-SM" -RetentionDays 30
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDir = "C:\SIGEC-SM\backups",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL n'est pas defini (ni parametre -DatabaseUrl, ni variable d'environnement)."
  exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error "pg_dump introuvable dans le PATH. Installez PostgreSQL pour Windows (voir docs/DEPLOYMENT_WINDOWS.md) ou ajoutez son dossier 'bin' au PATH."
  exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $BackupDir "sigec-sm_$timestamp.sql"
$gzFile = "$sqlFile.gz"

Write-Host "Sauvegarde de la base vers $gzFile..."
& pg_dump $DatabaseUrl --no-owner --no-privileges --file $sqlFile
if ($LASTEXITCODE -ne 0) {
  Write-Error "pg_dump a echoue (code $LASTEXITCODE)."
  exit 1
}

if (-not (Test-Path $sqlFile) -or (Get-Item $sqlFile).Length -eq 0) {
  Write-Error "La sauvegarde generee est vide, echec probable de pg_dump."
  Remove-Item -Force -ErrorAction SilentlyContinue $sqlFile
  exit 1
}

# Compression gzip via .NET (pas de dependance externe type 7-Zip).
$inStream = [System.IO.File]::OpenRead($sqlFile)
$outStream = [System.IO.File]::Create($gzFile)
$gzipStream = New-Object System.IO.Compression.GzipStream($outStream, [System.IO.Compression.CompressionLevel]::Optimal)
$inStream.CopyTo($gzipStream)
$gzipStream.Close()
$outStream.Close()
$inStream.Close()
Remove-Item -Force $sqlFile

$sizeKb = [math]::Round((Get-Item $gzFile).Length / 1KB, 1)
Write-Host "Sauvegarde terminee ($sizeKb Ko)."

# Purge des sauvegardes locales plus anciennes que RetentionDays. La copie
# hors site reste a organiser separement (voir docs/BACKUP.md) - ne pas
# purger avant confirmation de la copie distante en production.
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "sigec-sm_*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object {
    Write-Host "Purge : $($_.Name)"
    Remove-Item -Force $_.FullName
  }

Write-Host "Purge des sauvegardes de plus de $RetentionDays jours effectuee."
