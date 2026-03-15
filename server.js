import { readFileSync } from "fs";

import * as Events from "./event.js";
import * as Users from "./user.js";
import * as Commands from "./command.js";
import * as Protection from "./protection.js";

const PORT = 2579;

let badWordPatterns = [];

function loadBadwords() {
    try {
        badWordPatterns = readFileSync("./badwords.txt", "utf8").split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#"))
            .map((pattern) => new RegExp(pattern, "gi"));

        console.log(`Loaded ${badWordPatterns.length} bad-word pattern(s).`);
    } catch { }
}

loadBadwords();
Protection.loadPassword();

Events.registerEvent("player.join", (ev) => {
    const { name } = ev.data;

    console.log(`[JOIN] ${name}`);
    Users.broadcast({
        type: "system",
        text: `${name} has joined the channel`
    });
});

Events.registerEvent("player.leave", (ev) => {
    const { name } = ev.data;

    console.log(`[LEAVE] ${name}`);
    Users.broadcast({
        type: "system",
        text: `${name} has left the channel`
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

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
    const text = chunk.trim();
    if (!text) return;

    Commands.executeAsServer(text, Users.broadcast, (t) => console.log(`[CMD] ${t}`));
});

class ListCmd extends Commands.Command {
    execute({ reply }, args) {
        reply(Users.formatUserList());
    }
}

class KickCmd extends Commands.Command {
    canUse({ isServer }) {
        return isServer === true;
    }

    execute({ reply }, args) {
        if (!args[0]) {
            reply("Usage: /kick <user> [reason]");
            return;
        }

        const target = [...Users.getClients().entries()].find(([, info]) => info.name.toLowerCase() === args[0].toLowerCase());
        if (!target) {
            reply(`User not found: ${args[0]}`);
            return;
        }

        const reason = args.slice(1).join(" ") || "You've been kicked.";

        Users.kick(target[0], reason);
        reply(`Kicked ${target[1].name}.`);
    }
}

class StopCmd extends Commands.Command {
    canUse({ isServer }) {
        return isServer === true;
    }

    execute({ reply }, _args) {
        reply("Server shutting down.");
        Users.broadcast({
            type: "server",
            text: "Server is shutting down."
        });

        setTimeout(() => process.exit(0), 500);
    }
}

Commands.registerCommand("list", new ListCmd());
Commands.registerCommand("kick", new KickCmd());
Commands.registerCommand("stop", new StopCmd());

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

        open(ws) {},

        message(ws, raw) {
            let msg;

            try {
                msg = JSON.parse(raw);
            } catch {
                Users.kick(ws, "Invalid JSON.");
                return;
            }

            if (msg.type === "register") {
                if (Users.getClients().has(ws)) {
                    Users.kick(ws, "Already registered.");
                    return;
                }

                if (Protection.password != null && !Protection.checkPassword(msg.password)) {
                    Users.kick(ws, "Invalid password.");
                    return;
                }

                const rawName = (msg.name ?? "").trim();

                Users.registerClient(ws, rawName);
                return;
            }

            if (msg.type === "message") {
                const client = Users.getClients().get(ws);
                if (!client) {
                    Users.kick(ws, "Not registered.");
                    return;
                }

                const text = msg.text ?? "";

                if (text.startsWith("/")) {
                    Commands.handleCommand(ws, client.name, text, Users.broadcast);
                    return;
                }

                const evData = {
                    name: client.name,
                    text: msg.text ?? "",
                    deleted: false
                };

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

            Users.kick(ws, "Unknown message type.");
        },

        close(ws) {
            Users.unregisterClient(ws);
        }
    },
});

console.log(`Server running on ws://localhost:${PORT}`);