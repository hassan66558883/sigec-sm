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
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
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
