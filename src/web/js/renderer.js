// Copyright (c) 2025 iiPython

// Modules
import { main, display } from "./html.js";

// Handle metadata
const musicbrainz = async (endpoint) => {
    return await (
        await fetch(`https://musicbrainz.org/ws/2/${endpoint}`, {
            headers: { "User-Agent": "iiPython CD Ripper/0.3.1 (https://github.com/iiPythonx/cdrip; ben@iipython.dev)" }
        })
    ).json();
}

// Main class
new (class {
    constructor() {
        this.websocket = new WebSocket("ws://localhost:8000/ws");
        this.websocket.addEventListener("open", () => {
            this.websocket.addEventListener("message", (e) => {
                const data = JSON.parse(e.data);
                console.log(data);
                switch (data.type) {
                    case "update":
                        this.on_update(data.progress);
                        break;

                    case "flac-complete":
                        this.on_update("done");
                        this.resolve();
                        break;

                    default:
                        if (this.resolve) {
                            this.resolve(data.value);
                            delete this.resolve;
                        }
                        break;
                }
            });

            this.check_interval = setInterval(() => this.check_drive(), 1000);
            this.check_drive();
        });

    }

    send(type, ...args) {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.websocket.send(JSON.stringify({ type, args }));
        });
    }

    async show_disc() {
        this.disc.artist = this.disc["artist-credit"][0]["name"];
        
        const convert_time = (milliseconds) => {
            let seconds = milliseconds / 1000;
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            minutes -= hours * 60;
            seconds = Math.round(seconds - (60 * minutes)).toString();
            return `${hours ? hours.toString().padStart(2, "0") + ":" : ""}${minutes.toString().padStart(2, "0")}:${seconds.padStart(2, "0")}`;
        }

        main.innerHTML = `
            <header>
                <section>
                    <img id = "cover" src = "http://coverartarchive.org/release/${this.disc.id}/front-250">
                </section>
                <section id = "title">
                    <h1>${this.disc.title}</h1>
                    <h2>${this.disc.artist}</h2>
                </section>
            </header>
            <footer>
                <section id = "tracks">
                    <div class = "track-container">
                        <table>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Length</th>
                            </tr>
                        </table>
                    </div>
                    <button id = "rip">Start ripping</button>
                    <div id = "progress"></div>
                </section>
                <section id = "metadata">
                    <span>Date: ${this.disc.date}</span>
                    <span>Runtime: ${convert_time(this.disc.media[0].tracks.map(track => track.length).reduce((x, y) => x + y))}</span>
                    <span>Country: ${this.disc["release-events"][0].area["iso-3166-1-codes"][0]}</span>
                    <span>Drive: ${this.drive}</span>
                    <hr>
                    <a href = "https://musicbrainz.org/release/${this.disc.id}" target = "_blank">MusicBrainz</a>
                    <a href = "https://last.fm/music/${this.disc.artist}/${this.disc.title}" target = "_blank">Last.fm</a>
                    <hr>
                    <div>
                        <input type = "checkbox" id = "open-in-picard">
                        <label for = "open-in-picard">Open in Picard</label>
                    </div>
                </section>
            </footer>
        `;

        // Populate track list
        for (const track of this.disc.media[0].tracks) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${track.number}</td>
                <td>${track.title}</td>
                <td>${convert_time(track.length)}</td>
                <td data-track-number = "${track.number}"></td>
            `;
            document.querySelector("tbody").appendChild(row);
        }

        // Ripping phase
        document.querySelector("#rip").addEventListener("click", async (e) => {
            if (e.currentTarget.innerText === "Eject disc") {
                this.send("eject_disc");
                this.check_interval = setInterval(() => this.check_drive(), 1000);
                this.check_drive();
                return;
            }
            this.rip_disc();
        });
    }

    async on_update(update) {
        const track_count = this.disc.media[0].tracks.length;
        if (update === "done") {
            document.querySelector("button").innerText = "Eject disc";
            return;
        }
        document.querySelector("#progress").style.width = `${(update / (track_count * 2)) * 100}%`;
        if (update <= track_count) document.querySelector(`td[data-track-number = "${+update}"]`).innerText = "✓";
    }

    async rip_disc() {
        const path = await new Promise(async (resolve) => {
            const dialog = document.createElement("dialog");
            dialog.open = true;
            dialog.innerHTML = `
                <div>
                    <h2>Select storage path</h2>
                    <input value = "${await this.send("fetch_music_path")}" id = "path" autofocus>
                    <button id = "path-confirm">Rip!</button>
                </div>
            `;
            document.body.appendChild(dialog);
            document.querySelector("#path-confirm").addEventListener("click", () => {
                resolve(document.querySelector("#path").value);
                dialog.remove();
            })
        });

        // Calculate album path
        const folder_path = `${path}/${this.disc.artist} - ${this.disc.title}/`;

        await this.send("rip_disc", folder_path);  // do NOT remove end slash
        await this.send(
            "convert_flac",
            folder_path,
            this.disc.media[0].tracks.map(track => [
                `${track.number.padStart(2, "0")} ${track.title.replace("/", "_")}.flac`,
                track.title
            ]),
            this.disc.id
        );
        if (document.querySelector("#open-in-picard").checked) this.send("open_picard", folder_path);
    }

    async fetch_metadata(toc) {
        const response = await musicbrainz(`discid/-?toc=${toc}&fmt=json`);
        if (response.error || !response.releases || !response.releases.length) return null;
        return await musicbrainz(`release/${response["releases"][0].id}?inc=artists+recordings&fmt=json`);
    }

    async check_drive() {
        this.drive = await this.send("fetch_drive");
        if (!this.drive) return display("no_drive");
        
        const toc = await this.send("fetch_toc");
        if (!toc) return display("no_disc");
        
        clearInterval(this.check_interval);
        
        this.toc = toc;
        this.disc = await this.fetch_metadata(toc);

        if (!this.disc) return display("no_match");
        await this.show_disc();
    }
});
