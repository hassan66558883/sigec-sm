const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const { readConfig, writeConfig, generateServerSecrets } = require("./config-store");
const { startServer, resolveStandaloneDir } = require("./server-runner");

let mainWindow = null;
let setupWindow = null;
let serverProcess = null;

// Etat de reconnexion par fenetre — win -> { attempt, pending }. `pending`
// evite d'empiler plusieurs boucles de retry paralleles quand
// did-fail-load se declenche plusieurs fois pour le meme echec (ce qu'il
// fait normalement : une fois pour l'echec initial, puis a nouveau pour
// chaque tentative manquee).
const reconnectState = new WeakMap();
const OFFLINE_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <html><body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f4f6fa;color:#1a2330;">
    <div style="text-align:center;">
      <h2>SIGEC-SM — Connexion indisponible</h2>
      <p style="color:#5b6b7d;">Nouvelle tentative de connexion au serveur...</p>
    </div>
  </body></html>
`)}`;

function iconPath() {
  return path.join(__dirname, "..", "build", "icon.ico");
}

// Poll l'URL cible jusqu'a ce qu'elle reponde, plutot que de laisser
// Electron afficher sa page d'erreur generique en anglais. C'est le
// comportement "hors ligne" de la phase 1 : lecture seule impossible tant
// que la connexion n'est pas retablie, jamais de double-saisie possible
// puisqu'il n'existe qu'une seule base de donnees (un seul serveur
// central, un seul PostgreSQL — voir docs/DEPLOYMENT_WINDOWS.md).
function scheduleReconnect(win, targetUrl) {
  if (win.isDestroyed()) return;
  const state = reconnectState.get(win) || { attempt: 0, pending: false };
  if (state.pending) return;
  reconnectState.set(win, { ...state, pending: true });

  if (win.webContents.getURL() !== OFFLINE_HTML) {
    win.loadURL(OFFLINE_HTML).catch(() => {});
  }

  setTimeout(() => {
    if (win.isDestroyed()) return;
    reconnectState.set(win, { attempt: state.attempt + 1, pending: false });
    win.loadURL(targetUrl).catch(() => {});
  }, Math.min(2000 + state.attempt * 1000, 10000));
}

function createMainWindow(targetUrl) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "SIGEC-SM",
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Fenetre de contenu = l'application SIGEC-SM elle-meme (servie par
      // Next.js, meme code que la version web) : aucun besoin d'API
      // Electron cote page, donc sandbox complet.
      sandbox: true,
    },
  });

  // Les liens externes (ex. futures aides/documentation) s'ouvrent dans le
  // navigateur systeme, jamais dans une nouvelle fenetre Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(targetUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Point d'entree UNIQUE de la boucle de reconnexion : did-fail-load se
  // declenche aussi bien pour l'echec du chargement initial ci-dessous que
  // pour une coupure reseau en cours de session (rechargement, navigation
  // cote serveur qui echoue) — un seul chemin de retry, pas de logique
  // dupliquee entre "premier chargement" et "reconnexion".
  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (errorCode === -3) return; // ERR_ABORTED : navigation interrompue normalement (ex. clic rapide), pas une vraie panne
    scheduleReconnect(mainWindow, targetUrl);
  });

  mainWindow.loadURL(targetUrl).catch(() => {});
}

function openSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 560,
    height: 640,
    title: "SIGEC-SM — Configuration",
    icon: iconPath(),
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "setup-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, "setup.html"));
}

async function launchServerRole(config) {
  const standaloneDir = resolveStandaloneDir(app.isPackaged, process.resourcesPath, path.join(__dirname, ".."));
  const { child, ready } = startServer({ standaloneDir, serverConfig: config.server });
  serverProcess = child;
  await ready;
  createMainWindow(config.server.appBaseUrl);
}

function launchClientRole(config) {
  createMainWindow(config.client.serverUrl);
}

ipcMain.handle("setup:submit", async (_event, formConfig) => {
  try {
    if (formConfig.role === "server") {
      const secrets = generateServerSecrets();
      const port = formConfig.server.port || 3100;
      const config = {
        role: "server",
        server: {
          databaseUrl: formConfig.server.databaseUrl,
          port,
          appBaseUrl: `http://127.0.0.1:${port}`,
          ...secrets,
        },
      };
      writeConfig(config);
      await launchServerRole(config);
    } else {
      const config = { role: "client", client: { serverUrl: formConfig.client.serverUrl } };
      writeConfig(config);
      launchClientRole(config);
    }
    if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close();
    return { ok: true };
  } catch (err) {
    return { error: err && err.message ? err.message : "Echec du demarrage du serveur." };
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Boucle de developpement : `npm run electron:dev` pointe directement sur
  // le serveur `next dev` deja lance separement (voir package.json) —
  // aucune configuration, aucun serveur autonome empaquete requis, pour
  // iterer vite sur le shell Electron lui-meme.
  if (process.env.ELECTRON_DEV_URL) {
    createMainWindow(process.env.ELECTRON_DEV_URL);
    return;
  }

  const config = readConfig();
  if (!config) {
    openSetupWindow();
    return;
  }

  if (config.role === "server") {
    try {
      await launchServerRole(config);
    } catch (err) {
      console.error("Echec du demarrage du serveur local:", err);
      openSetupWindow();
    }
  } else {
    launchClientRole(config);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
