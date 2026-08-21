import { contextBridge, ipcRenderer } from "electron";

// The renderer only receives the single lifecycle action it needs. It has no
// general Node.js, filesystem, or IPC access.
contextBridge.exposeInMainWorld("forgedeckDesktop", {
  quit: () => ipcRenderer.invoke("forgedeck:quit"),
});
