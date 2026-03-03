import { readFileSync } from "fs";
import * as Events from "./event.js";
import * as Users from "./user.js";

const PORT = 2579;
const NAME_REGEX = /^[A-Za-z0-9_]{3,24}$/;

let badWordPatterns = [];

try {
    const raw = readFileSync("./badwords.txt", "utf8");
    badWordPatterns = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((pattern) => new RegExp(pattern, "gi"));

    console.log(`Loaded ${badWordPatterns.length} bad-word pattern(s).`);
} catch {
    console.warn("badwords.txt not found — no word filtering active.");
}

Events.registerEvent("player.join", (ev) => {
    const { name } = ev.data;

    console.log(`[JOIN] ${name}`);
    Users.broadcast({
        type: "system",
        text: `${name} has joined the channel`,
        kind: "join",
    });
});

Events.registerEvent("player.leave", (ev) => {
    const { name } = ev.data;

    console.log(`[LEAVE] ${name}`);
    Users.broadcast({
        type: "system",
        text: `${name} has left the channel`,
        kind: "leave",
    });
});

Events.registerEvent("player.message", (ev) => {
    let { text } = ev.data;

    text = text.trim().slice(0, 512);
    text = text.replace(/<[^>]*>/g, "");

    if (!text) {
        ev.cancel();
        return;
    }

    let deleted = false;
    for (const pattern of badWordPatterns) {
        pattern.lastIndex = 0;

        if (pattern.test(text)) {
            deleted = true;
            break;
        }
    }

    if (deleted) {
        ev.data.text = "< message deleted >";
        ev.data.deleted = true;
    } else {
        ev.data.text = text;
    }
});

const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
        const url = new URL(req.url);

        if (req.method === "OPTIONS") return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });

        if (server.upgrade(req, { data: { name: null } })) return;

        return new Response(JSON.stringify({ status: "IRC server running" }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    },

    websocket: {
        perMessageDeflate: true,

        open(ws) {
            ws.send(JSON.stringify({ type: "need_name" }));
        },

        message(ws, raw) {
            let msg;

            try {
                msg = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ type: "error", text: "Invalid JSON." }));
                return;
            }

            if (msg.type === "register") {
                if (Users.clients.has(ws)) {
                    ws.send(JSON.stringify({ type: "error", text: "Already registered." }));
                    return;
                }

                const raw_name = (msg.name ?? "").trim();

                Users.registerClient(ws, raw_name, NAME_REGEX);
                return;
            }

            if (msg.type === "message") {
                const client = Users.clients.get(ws);
                if (!client) {
                    ws.send(JSON.stringify({ type: "error", text: "Not registered." }));
                    return;
                }

                const evData = { name: client.name, text: msg.text ?? "", deleted: false };
                const msgEvent = Events.fireEvent("player.message", evData);
                if (msgEvent.isCancelled()) return;

                Users.broadcast({
                    type: "message",
                    name: evData.name,
                    text: evData.text,
                    deleted: evData.deleted,
                    ts: Date.now(),
                });

                return;
            }

            ws.send(JSON.stringify({ type: "error", text: "Unknown message type." }));
        },

        close(ws) {
            Users.unregisterClient(ws);
        }
    },
});

console.log(`Server running on ws://localhost:${PORT}`);