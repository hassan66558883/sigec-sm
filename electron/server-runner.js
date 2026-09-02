// Demarre le serveur Next.js autonome (.next/standalone/server.js, genere
// par `npm run build` avec output:"standalone" — voir next.config.mjs) en
// sous-processus, avec les variables d'environnement necessaires. Utilise
// uniquement quand ce poste a le role "serveur central" (voir main.js) :
// un poste "client" n'a besoin d'aucun serveur local.
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

// En dev, `standaloneDir` pointe vers .next/standalone du depot source. Une
// fois empaquete, electron-builder copie ce meme dossier dans
// resources/standalone (voir electron-builder.yml, extraResources) — le
// chemin differe donc entre dev et paquet installe.
function resolveStandaloneDir(isPackaged, resourcesPath, appRoot) {
  return isPackaged ? path.join(resourcesPath, "standalone") : path.join(appRoot, ".next", "standalone");
}

function waitForHealthy(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error("Le serveur local n'a pas repondu a temps."));
      setTimeout(tick, 500);
    };
    tick();
  });
}

// serverConfig: { databaseUrl, port, sessionSecret, encryptionKey, cronSecret, appBaseUrl }
function startServer({ standaloneDir, serverConfig }) {
  // path.resolve() defensivement : si standaloneDir n'est pas deja absolu,
  // passer un chemin relatif a la fois comme argument script ET comme cwd
  // du sous-processus double le chemin (Node resout l'argument relatif au
  // NOUVEAU cwd du process demarre, pas a celui de l'appelant).
  const absoluteStandaloneDir = path.resolve(standaloneDir);
  const child = spawn(process.execPath, [path.join(absoluteStandaloneDir, "server.js")], {
    cwd: absoluteStandaloneDir,
    env: {
      ...process.env,
      // Sans cette variable, `process.execPath` (le binaire Electron
      // empaquete lui-meme, utilise ici comme runtime Node) relance une
      // instance complete de l'app au lieu d'executer server.js comme un
      // script Node ordinaire — le serveur ne demarre jamais et aucune
      // erreur claire n'apparait (juste un nouveau process SIGEC-SM.exe qui
      // ne repond jamais sur le port attendu). Bug constate et corrige le
      // 2026-09-02. Voir la doc Electron sur `ELECTRON_RUN_AS_NODE`.
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(serverConfig.port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: serverConfig.databaseUrl,
      SESSION_SECRET: serverConfig.sessionSecret,
      ENCRYPTION_KEY: serverConfig.encryptionKey,
      CRON_SECRET: serverConfig.cronSecret,
      APP_BASE_URL: serverConfig.appBaseUrl,
    },
    stdio: "pipe",
  });

  child.stdout.on("data", (d) => console.log(`[sigec-sm-server] ${d}`.trimEnd()));
  child.stderr.on("data", (d) => console.error(`[sigec-sm-server] ${d}`.trimEnd()));

  return { child, ready: waitForHealthy(serverConfig.port) };
}

module.exports = { startServer, resolveStandaloneDir };
