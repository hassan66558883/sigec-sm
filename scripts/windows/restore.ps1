<#
.SYNOPSIS
  Restauration d'une sauvegarde SIGEC-SM (equivalent Windows de
  scripts/restore.sh). A tester regulierement sur un environnement de
  verification, PAS sur la production, sauf en cas de sinistre reel
  confirme (voir docs/BACKUP.md).

.PARAMETER BackupFile
  Chemin vers le fichier .sql.gz a restaurer.

.PARAMETER TargetDatabaseUrl
  Chaine de connexion PostgreSQL CIBLE - son contenu sera REMPLACE.

.EXAMPLE
  .\restore.ps1 -BackupFile "C:\SIGEC-SM\backups\sigec-sm_20260828_020000.sql.gz" -TargetDatabaseUrl "postgresql://user:pass@localhost:5432/sigec_sm_test"
#>
param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$TargetDatabaseUrl
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  Write-Error "Fichier de sauvegarde introuvable : $BackupFile"
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql introuvable dans le PATH. Installez PostgreSQL pour Windows ou ajoutez son dossier 'bin' au PATH."
  exit 1
}

$maskedUrl = $TargetDatabaseUrl -replace '://[^@]*@', '://***@'
Write-Host "ATTENTION : cette operation va REMPLACER le contenu de la base cible." -ForegroundColor Yellow
Write-Host "  Cible : $maskedUrl"
$confirm = Read-Host "Confirmer la restauration ? (taper 'oui' pour continuer)"
if ($confirm -ne "oui") {
  Write-Host "Annule."
  exit 1
}

$sqlFile = [System.IO.Path]::ChangeExtension($BackupFile, $null).TrimEnd(".")

Write-Host "Decompression..."
$inStream = [System.IO.File]::OpenRead($BackupFile)
$gzipStream = New-Object System.IO.Compression.GzipStream($inStream, [System.IO.Compression.CompressionMode]::Decompress)
$outStream = [System.IO.File]::Create($sqlFile)
$gzipStream.CopyTo($outStream)
$outStream.Close()
$gzipStream.Close()
$inStream.Close()

try {
  Write-Host "Restauration en cours..."
  & psql $TargetDatabaseUrl --file $sqlFile
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql a echoue (code $LASTEXITCODE)."
    exit 1
  }
  Write-Host "Restauration terminee. Verifiez l'integrite des donnees avant de basculer le trafic."
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $sqlFile
}
