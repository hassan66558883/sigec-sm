<#
.SYNOPSIS
  Prepare la base PostgreSQL pour SIGEC-SM sur le poste "serveur central"
  (equivalent Windows des commandes `CREATE ROLE`/`CREATE DATABASE` de
  docs/DEPLOYMENT.md, section Linux). Suppose PostgreSQL pour Windows deja
  installe (voir docs/DEPLOYMENT_WINDOWS.md, etape 1) - ce script ne
  l'installe pas lui-meme.

  Idempotent : si le role ou la base existent deja, ne les recree pas et
  ne touche a aucune donnee existante.

.PARAMETER PgSuperuser
  Compte superutilisateur PostgreSQL local (defaut : postgres). Son mot de
  passe est demande de maniere interactive (jamais en parametre en clair).

.EXAMPLE
  .\setup-postgres.ps1
#>
param(
  [string]$PgSuperuser = "postgres"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql introuvable dans le PATH. Installez PostgreSQL pour Windows d'abord (voir docs/DEPLOYMENT_WINDOWS.md, etape 1), puis ajoutez son dossier 'bin' (ex: C:\Program Files\PostgreSQL\16\bin) au PATH."
  exit 1
}

function Read-PlainPassword([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

$superuserPassword = Read-PlainPassword "Mot de passe du superutilisateur PostgreSQL '$PgSuperuser'"
$appPassword = Read-PlainPassword "Nouveau mot de passe pour le role applicatif 'sigec'"

function Invoke-Psql([string]$Sql) {
  # PGPASSWORD est lu par psql lui-meme pour cette invocation uniquement -
  # jamais persiste, jamais affiche.
  $env:PGPASSWORD = $superuserPassword
  try {
    & psql -U $PgSuperuser -h localhost -d postgres -t -c $Sql
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

Write-Host "Verification du role 'sigec'..."
$roleExists = (Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname='sigec';").Trim()
if ($roleExists -eq "1") {
  Write-Host "  Le role 'sigec' existe deja - mot de passe inchange (utilisez ALTER ROLE manuellement si besoin)."
} else {
  # Mot de passe echappe pour l'inclusion litterale dans l'instruction SQL
  # (doublement du guillemet simple - syntaxe standard PostgreSQL).
  $escapedPassword = $appPassword -replace "'", "''"
  Invoke-Psql "CREATE ROLE sigec LOGIN PASSWORD '$escapedPassword';"
  Write-Host "  Role 'sigec' cree."
}

Write-Host "Verification de la base 'sigec_sm'..."
$dbExists = (Invoke-Psql "SELECT 1 FROM pg_database WHERE datname='sigec_sm';").Trim()
if ($dbExists -eq "1") {
  Write-Host "  La base 'sigec_sm' existe deja - aucune donnee touchee."
} else {
  Invoke-Psql "CREATE DATABASE sigec_sm OWNER sigec;"
  Write-Host "  Base 'sigec_sm' creee."
}

Write-Host ""
Write-Host "Chaine de connexion a utiliser lors de la configuration de l'application :"
Write-Host "  postgresql://sigec:<mot_de_passe_choisi>@localhost:5432/sigec_sm"
Write-Host ""
Write-Host "Etapes suivantes : voir docs/DEPLOYMENT_WINDOWS.md (migrations, seed, puis lancement de SIGEC-SM.exe)."
