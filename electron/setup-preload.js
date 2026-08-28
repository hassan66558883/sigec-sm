const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sigecSetup", {
  submit: (config) => ipcRenderer.invoke("setup:submit", config),
});
