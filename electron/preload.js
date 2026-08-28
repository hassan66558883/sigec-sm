// Preload minimal : le contenu affiche est l'application SIGEC-SM elle-meme
// (le meme code que la version web, servi par le serveur Next.js local ou
// distant) — elle n'a besoin d'aucune API Electron. Ce fichier n'expose donc
// rien via contextBridge ; il existe uniquement pour desactiver explicitement
// l'integration Node dans la fenetre de contenu (voir BrowserWindow dans
// main.js : contextIsolation:true, nodeIntegration:false).
