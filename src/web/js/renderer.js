// Copyright (c) 2025 iiPython

import Connection from "./connection.js";
import { templates } from "./html.js";
import { lookup_disc } from "./api.js";

new class {
    #connection;
    #disc;

    constructor() {
        this.#connection = new Connection();
        this.#connection.bind("status-changed", (result) => this.#status_changed(result));
    }

    async #status_changed(result) {
        console.log("[Status Change]", result);
        if (result.status !== "has-disc") return templates[result.status]();

        // Lookup disc
        this.#disc = await lookup_disc(result.data.toc);
        if (!this.#disc) return templates["no-match"]();
        console.log(this.#disc);

        // Show ripping interface
        templates["rip-ui"]({ disc: this.#disc, drive: result.data.drive });
    }
});
