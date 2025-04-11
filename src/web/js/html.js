// Copyright (c) 2025 iiPython

const main = document.querySelector("main");
const display = (id) => {
    switch (id) {
        case "no_drive":
            main.innerHTML = `
                <section id = "error">
                    <h2>No Optical Drive</h2>
                    <p>The system did not return a valid optical drive, make sure you have one connected.</p>
                </section>
            `;
            break;

        case "no_disc":
            main.innerHTML = `
                <section id = "error">
                    <h2>Disc Required</h2>
                    <p>In order to rip a CD, the disc must be inserted into your optical drive. This program can not break the laws of physics.</p>
                </section>
            `;
            break;

        case "no_match":
            main.innerHTML = `
                <section id = "error">
                    <h2>MusicBrainz Lookup Failed</h2>
                    <p>The CD in your optical drive was not found in the Musicbrainz database. Ensure the disc is free of scratches so the TOC can be pulled successfully.</p>
                </section>
            `;
            break;
    }
}

export { main, display };
