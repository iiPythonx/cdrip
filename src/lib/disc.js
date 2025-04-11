// Copyright (c) 2025 iiPython

// Modules
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { exec, execSync, spawn } from "child_process";
import { ipcMain } from "electron";

// Disc handling
class DiscHandler {
    constructor() {
        this.webcontents = null;

        // Setup API handling
        ipcMain.handle("rip:fetch_toc", () => this.fetch_disc_toc());
        ipcMain.handle("rip:fetch_drive", () => this.fetch_drive_string());
        ipcMain.handle("rip:rip_disc", (_, ...args) => this.rip_disc(...args));
        ipcMain.handle("rip:convert_flac", (_, ...args) => this.convert_flac(...args));
    }

    async fetch_disc_toc() {
        let stdout = (await new Promise((resolve) => {
            exec("cdparanoia -Q", (error, stdout, stderr) => resolve(stderr));
        })).split("\n");

        // Calculate track offsets
        const lines = stdout.filter(line => /^\s+\d/.test(line));
        const offsets = lines.map((line) => +line.match(/(\d+) \[[\d:\.]+\]\s+no/)[1]);

        // Calculate leadout
        const leadout_match = stdout.filter(line => line.trim()).at(-1).match(/\w\s+(\d+)/);
        if (leadout_match === null) return null;  // No disc in drive

        // And, return the TOC
        return `1 ${offsets.length} ${leadout_match[1]} ${offsets.join(" ")}`;
    }

    async fetch_drive_string() {
        let [ stdout, stderr ] = (await new Promise((resolve) => {
            exec("udevadm info --query=all --name=/dev/sr0 --no-pager", (error, stdout, stderr) => resolve([stdout, stderr]));
        }));
        if (stderr.split("\n")[0].match(/nknown device/)) return null;
        return [
            stdout.match(/ID_VENDOR=(.+)/)[1],
            stdout.match(/ID_MODEL=(.+)/)[1]
        ].join(" ")
    }

    async rip_disc(path) {
        if (!existsSync(path)) mkdirSync(path);
        await (new Promise((resolve) => {
            
            // Spawn cdparanoia
            const process = spawn("cdparanoia", ["-B", "1-", path]);
            process.stderr.setEncoding("ascii");
            process.stderr.on("data", (data) => {
                const match = data.match(/outputting.*track(\d+)\.cdda\.wav/);
                if (match) this.webcontents.send("rip:update", match[1]);
            });
            process.on("close", () => { resolve(); });
        }))
    }

    async convert_flac(path, filenames, mbid) {
        for (const file of readdirSync(path)) {

            // If there's an existing FLAC file, delete it and move on
            if (file.match(/.*\.flac/)) {
                unlinkSync(join(path, file));
                continue;
            }

            // Calculate track index and new filename
            const index = +file.match(/track(\d+)\.cdda\.wav/)[1];
            const [ new_name, title ] = filenames[index - 1];

            // Convert to FLAC and add metadata
            execSync(`ffmpeg -i "${join(path, file)}" -metadata title="${title}" -metadata musicbrainz_albumid="${mbid}" "${join(path, new_name)}"`);
            unlinkSync(join(path, file));  // Remove old WAV file
            this.webcontents.send("rip:update", index + filenames.length);
        }
        this.webcontents.send("rip:update", "done");
    }
}

export default (new DiscHandler());
