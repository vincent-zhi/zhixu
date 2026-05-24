import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rendererEntry = path.resolve(currentDir, "../dist/index.html");
async function createWindow() {
    const window = new BrowserWindow({
        width: 1180,
        height: 760,
        minWidth: 860,
        minHeight: 620,
        title: "知序",
        backgroundColor: "#f8f7f2",
        webPreferences: {
            preload: path.join(currentDir, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    await window.loadFile(rendererEntry);
}
ipcMain.handle("platform-status", () => "Electron runtime ready");
app.whenReady().then(async () => {
    await createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            void createWindow();
        }
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
//# sourceMappingURL=main.js.map