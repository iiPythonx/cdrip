// Copyright (c) 2025 iiPython

// Modules
const path = require("path");
const { app, shell, BrowserWindow, ipcMain, dialog } = require("electron");
const { exec } = require("child_process");

const disc = (require("./lib/disc")).default;

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "lib/preload.js")
        }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });
    disc.webcontents = mainWindow.webContents;
    mainWindow.loadFile(path.join(__dirname, "web/index.html"));
}

app.whenReady().then(() => {
    ipcMain.handle("util:choose_folder", () => {
        return dialog.showOpenDialogSync(null, {
            title: "Select folder to store album",
            properties: ["openDirectory", "createDirectory"]
        });
    });
    ipcMain.handle("util:open_picard", async (_, path) => {
        return await new Promise((resolve) => exec(`picard "${path}"`, (error) => {
            resolve(error === null);
        }))
    });
    ipcMain.handle("util:eject_disc", () => { exec("eject"); });

    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
});
