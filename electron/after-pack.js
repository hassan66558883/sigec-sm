// electron-builder applique un motif d'exclusion global `!**/node_modules/**`
// a TOUTES les copies de fichiers, y compris `extraResources` — meme avec un
// `filter` explicite dessus (verifie le 2026-09-02 : `filter: ["**/*"]` ne
// suffit pas, le node_modules autonome de `next build output:"standalone"`
// reste absent du paquet, et le serveur empaquete ne demarre jamais :
// "Cannot find module 'next'"). Contournement standard pour ce cas connu :
// copier ce dossier nous-memes apres le packaging, en dehors du systeme de
// filtrage d'electron-builder.
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const src = path.join(context.appOutDir, "resources", "standalone", "node_modules");
  const from = path.join(context.packager.projectDir, ".next", "standalone", "node_modules");

  if (!fs.existsSync(from)) {
    throw new Error(`afterPack: introuvable ${from} — lancez 'npm run build' avant 'electron-builder'.`);
  }

  fs.cpSync(from, src, { recursive: true, dereference: true });
  console.log(`[after-pack] node_modules copie vers ${src}`);
};
