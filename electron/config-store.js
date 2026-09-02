// Stockage de la configuration locale du poste (role serveur/client, URL du
// serveur central, secrets applicatifs). Volontairement un simple fichier
// JSON dans userData plutot qu'une dependance externe (electron-store) —
// le besoin est minimal (lire/ecrire un objet une fois au demarrage).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    // Un editeur (Notepad, PowerShell Set-Content -Encoding utf8...) peut
    // ecrire un BOM UTF-8 en tete de fichier — JSON.parse le rejette
    // silencieusement (renvoie null ici, donc l'assistant de configuration
    // se rouvre sans message d'erreur). Bug constate et corrige le
    // 2026-09-02 en preparant un config.json manuellement pour une
    // presentation.
    const BOM = "﻿";
    let raw = fs.readFileSync(configPath(), "utf8");
    if (raw.charCodeAt(0) === BOM.charCodeAt(0)) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}

// Genere une seule fois et persiste : SESSION_SECRET/ENCRYPTION_KEY doivent
// rester stables entre redemarrages (sessions et champs chiffres en BDD en
// dependent), sinon chaque redemarrage invaliderait toutes les sessions et
// rendrait illisibles les champs deja chiffres.
function generateServerSecrets() {
  return {
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    encryptionKey: crypto.randomBytes(32).toString("hex"),
    cronSecret: crypto.randomBytes(24).toString("hex"),
  };
}

module.exports = { readConfig, writeConfig, generateServerSecrets, configPath };
