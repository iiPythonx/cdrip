// Copyright (c) 2025 iiPython

// Modules
import { main, display } from "./html.js";

// Handle metadata
const musicbrainz = async (endpoint) => {
    return await (
        await fetch(`https://musicbrainz.org/ws/2/${endpoint}`, {
            headers: { "User-Agent": "iiPython CD Ripper/0.2.1 (ben@iipython.dev)" }
        })
    ).json();
}

// Main class
new (class {
    constructor() {
        this.check_interval = setInterval(() => this.check_drive(), 1000);
        this.check_drive();
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
                await ripapi.eject_disc();
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
            return new Notification("Rip complete", { body: `All ${track_count} tracks ripped.` });
        }
        document.querySelector("#progress").style.width = `${(update / (track_count * 2)) * 100}%`;
        if (update <= track_count) document.querySelector(`td[data-track-number = "${+update}"]`).innerText = "✓";
    }

    async rip_disc() {
        const path = await ripapi.choose_folder();
        if (!path) return;

        // Calculate album path
        ripapi.rip_update((update) => this.on_update(update));

        const folder_path = `${path[0]}/${this.disc.artist} - ${this.disc.title}/`;
        await ripapi.rip_disc(folder_path);  // do NOT remove end slash
        await ripapi.convert_flac(
            folder_path,
            this.disc.media[0].tracks.map(track => [
                `${track.number.padStart(2, "0")} ${track.title.replace("/", "_")}.flac`,
                track.title
            ]),
            this.disc.id
        );
        if (document.querySelector("#open-in-picard").checked) {
            if (!await ripapi.open_picard(folder_path))
                return new Notification("Can't open picard", { body: "Click here to download it" }).addEventListener("click", () => {
                    const a = document.createElement("a");
                    a.href = "https://picard.musicbrainz.org";
                    a.target = "_blank";
                    a.click();
                });
        }
    }

    async fetch_metadata(toc) {
        const response = await musicbrainz(`discid/-?toc=${toc}&fmt=json`);
        if (response.error || !response.releases || !response.releases.length) return null;
        return await musicbrainz(`release/${response["releases"][0].id}?inc=artists+recordings&fmt=json`);
    }

    async check_drive() {
        this.drive = await ripapi.fetch_drive();
        if (!this.drive) return display("no_drive");
        
        const toc = await ripapi.fetch_toc();
        if (!toc) return display("no_disc");
        
        clearInterval(this.check_interval);
        
        this.toc = toc;
        this.disc = await this.fetch_metadata(toc);

        if (!this.disc) return display("no_match");
        await this.show_disc();
    }
});
