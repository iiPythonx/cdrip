// Copyright (c) 2025 iiPython

import { fetch_cover } from "./api.js";

// Handle templating
function generate_error(header, description) {
    return `
        <section id = "error">
            <h2>${header}</h2>
            <p>${description}</p>
        </section>
    `;
}

const convert_time = (milliseconds) => {
    let seconds = milliseconds / 1000;
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    minutes -= hours * 60;
    seconds = Math.round(seconds - (60 * minutes)).toString();
    return `${hours ? hours.toString().padStart(2, "0") + ":" : ""}${minutes.toString().padStart(2, "0")}:${seconds.padStart(2, "0")}`;
}

// Setup actual templates
const templates = {
    "no-drive": () => {
        document.querySelector("main").innerHTML = generate_error(
            "No Optical Drive",
            "The system did not return a valid optical drive, make sure you have one connected."
        );
    },
    "no-disc": () => {
        document.querySelector("main").innerHTML = generate_error(
            "Disc Required",
            "In order to rip a CD, the disc must be inserted into your optical drive. This program can not break the laws of physics."
        );
    },
    "no-match": () => {
        document.querySelector("main").innerHTML = generate_error(
            "Musicbrainz Lookup Failed",
            "The CD in your optical drive was not found in the Musicbrainz database. Ensure the disc is free of scratches so the TOC can be pulled successfully."
        );
    },
    "rip-ui": async (data) => {
        const { disc, drive } = data;

        // Process data
        const artist_name = disc["artist-credit"][0].name;
        document.querySelector("main").innerHTML = `
            <header>
                <section>
                    <img id = "cover" src = "${fetch_cover(disc.id)}">
                </section>
                <section id = "title">
                    <h1>${disc.title}</h1>
                    <h2>${artist_name}</h2>
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
                                <th></th>
                            </tr>
                        </table>
                    </div>
                    <button id = "rip">Start ripping</button>
                    <div id = "progress"></div>
                </section>
                <section id = "metadata">
                    <span>Date: ${disc.date}</span>
                    <span>Runtime: ${convert_time(disc.media[0].tracks.map(track => track.length).reduce((x, y) => x + y))}</span>
                    <span>Country: ${disc.country}</span>
                    <span>Drive: ${drive}</span>
                    <hr>
                    <a target = "_blank" href = "https://musicbrainz.org/release/${disc.id}">MusicBrainz</a>
                    <a target = "_blank" href = "https://last.fm/music/${artist_name}/${disc.title}">Last.fm</a>
                    <hr>
                    <div>
                        <input type = "checkbox" id = "open-in-picard">
                        <label for = "open-in-picard">Open in Picard</label>
                    </div>
                </section>
            </footer>
        `;

        // Load in tracks
        for (const track of disc.media[0].tracks) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${}</td>
                <td>${}</td>
                <td>${}</td>
                <td>${}</td>
            `;
            document.querySelector("table").appendChild(row);
        }
    }
}

export { templates };
