import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("zhixuDesktop", {
    platformStatus: () => ipcRenderer.invoke("platform-status")
});
//# sourceMappingURL=preload.js.map