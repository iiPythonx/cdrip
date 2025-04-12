// Copyright (c) 2025 iiPython

// Modules
import notifier from "node-notifier";
import { join } from "path";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { spawn } from "child_process";

// Disc handling
class DiscHandler {
    constructor() {
        this.websocket = null;
    }

    async fetch_disc_toc() {
        const stdout = Bun.spawnSync(["cdparanoia", "-Q"]).stderr.toString().split("\n");

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
        const process = Bun.spawnSync(["udevadm", "info", "--query=all", "--name=/dev/sr0", "--no-pager"]);
        if (process.stderr.toString().split("\n")[0].match(/nknown device/)) return null;
        const stdout = process.stdout.toString();
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
                if (match) this.websocket.send(JSON.stringify({ type: "update", progress: match[1] }));
            });
            process.on("close", () => { resolve(); });
        }));
        this.websocket.send(JSON.stringify({ type: "rip-complete" }));
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
            Bun.spawnSync(["ffmpeg", "-i", join(path, file), "-metadata", `title=${title}`, "-metadata", `musicbrainz_albumid=${mbid}`, join(path, new_name)]);
            unlinkSync(join(path, file));  // Remove old WAV file
            this.websocket.send(JSON.stringify({ type: "update", progress: index + filenames.length }));
        }
        this.websocket.send(JSON.stringify({ type: "flac-complete" }));
        notifier.notify({
            title: "Rip complete!",
            message: "All tasks done."
        });
    }
}

export default (new DiscHandler());
