// Copyright (c) 2025 iiPython

// Modules
const { contextBridge, ipcRenderer } = require("electron/renderer");

// Expose API
contextBridge.exposeInMainWorld("ripper_api", {
    choose_folder: () => ipcRenderer.invoke("util:choose_folder"),
    open_picard: (path) => ipcRenderer.invoke("util:open_picard", path),
    fetch_toc: () => ipcRenderer.invoke("rip:fetch_toc"),
    fetch_drive: () => ipcRenderer.invoke("rip:fetch_drive"),
    rip_disc: (path) => ipcRenderer.invoke("rip:rip_disc", path),
    rip_update: (callback) => ipcRenderer.on("rip:update", (_event, value) => callback(value)),
    convert_flac: (path, filenames, mbid) => ipcRenderer.invoke("rip:convert_flac", path, filenames, mbid),
});
