// Copyright (c) 2025 iiPython

// Modules
import notifier from "node-notifier";
import disc from "./lib/disc";

// Handle embedding files
const mimetypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
};

async function find_files() {
    const files = new Map();
    for (const file of Bun.Glob("**").scanSync("src/web")) {
        files.set(file === "index.html" ? "/" : "/" + file, {
            content: await Bun.file(`src/web/${file}`).arrayBuffer(),
            type: mimetypes[file.slice(file.lastIndexOf("."))],
        });
    }
    return files;
}

const files = await find_files();

// Launch websocket handler
Bun.serve({
    port: 8000,
    fetch(req, server) {
        const path = new URL(req.url).pathname;
        if (path === "/ws") {
            if (server.upgrade(req)) return;
            return new Response("Upgrade failed", { status: 500 });
        }

        const file = files.get(path);
        return new Response(file.content, { headers: { "Content-Type": file.type } });
    },
    error: () => {
        return new Response("Not found", { status: 404 });
    },  
    websocket: {
        open: (ws) => { disc.websocket = ws; },
        async message(ws, message) {
            const command = JSON.parse(message);
            switch (command.type) {
                case "fetch_drive":
                    ws.send(JSON.stringify({ value: await disc.fetch_drive_string() }));
                    break;

                case "fetch_toc":
                    ws.send(JSON.stringify({ value: await disc.fetch_disc_toc() }));
                    break;

                case "rip_disc":
                    await disc.rip_disc(...command.args);
                    break;

                case "convert_flac":
                    await disc.convert_flac(...command.args);
                    break;

                case "eject_disc":
                    Bun.spawn(["eject"]);
                    break;

                case "open_picard":
                    try {
                        Bun.spawn(["picard", command.args[0]]);
                    } catch {
                        notifier.notify({
                            title: "Can't open picard!",
                            message: "Click here to download it.",
                            wait: true
                        });
                        notifier.on("click", () => { Bun.spawn(["xdg-open", "https://picard.musicbrainz.org"]); });
                    }
                    break;

                case "fetch_music_path":
                    ws.send(JSON.stringify({ value: `${process.env.HOME}/Music` }));
                    break;
            }
        },
    },
});
await Bun.spawn(["xdg-open", "http://localhost:8000"]);

// // Modules
// const path = require("path");
// const { app, shell, BrowserWindow, ipcMain, dialog } = require("electron");
// const { exec } = require("child_process");

// const disc = (require("./lib/disc")).default;

// const createWindow = () => {
//     const mainWindow = new BrowserWindow({
//         width: 1000,
//         height: 600,
//         webPreferences: {
//             preload: path.join(__dirname, "lib/preload.js")
//         }
//     });
//     mainWindow.setMenuBarVisibility(false);
//     mainWindow.webContents.setWindowOpenHandler((details) => {
//         shell.openExternal(details.url);
//         return { action: "deny" };
//     });
//     disc.webcontents = mainWindow.webContents;
//     mainWindow.loadFile(path.join(__dirname, "web/index.html"));
// }

// app.whenReady().then(() => {
//     ipcMain.handle("util:choose_folder", () => {
//         return dialog.showOpenDialogSync(null, {
//             title: "Select folder to store album",
//             properties: ["openDirectory", "createDirectory"]
//         });
//     });
//     ipcMain.handle("util:open_picard", async (_, path) => {
//         return await new Promise((resolve) => exec(`picard "${path}"`, (error) => {
//             resolve(error === null);
//         }))
//     });
//     ipcMain.handle("util:eject_disc", () => { exec("eject"); });

//     createWindow();
//     app.on("activate", () => {
//         if (BrowserWindow.getAllWindows().length === 0) createWindow();
//     })
// });

// app.on("window-all-closed", () => {
//     if (process.platform !== "darwin") app.quit()
// });
