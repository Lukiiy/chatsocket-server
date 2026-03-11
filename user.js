import { fireEvent } from "./event.js";

const clients = new Map(); // websocket ( user, joinedAt )

/**
 * Get a snapshot of the clients map.
 * @returns {Map}
 */
export function getClients() {
    return new Map(clients);
}

/**
 * Get all connected users.
 */
export function getAllUsers() {
    return [...clients.values()];
}

export function formatUserList() {
    const users = getAllUsers();

    return `Online (${users.length}): ${users.map(u => u.name).join(", ")}`;
}

export function sendToClient(ws, payload) {
    if (!ws || ws.readyState !== 1) return false;

    try {
        ws.send(JSON.stringify(payload));

        return true;
    } catch {
        return false;
    }
}

/**
 * Broadcasts a payload to all connected clients.
 * @param {object} payload The object to serialize and send.
 */
export function broadcast(payload) {
    for (const [user] of clients) sendToClient(user, payload);
}

export function kick(ws, reason = "Kicked from server.") {
    try {
        ws.send(JSON.stringify({
            type: "kick",
            reason
        }));
    } catch { }

    try {
        ws.close();
    } catch { }
}

/**
 * Sends a server text message to a client.
 * @param {WebSocket|string} id Target's username or websocket.
 * @param {string} text
 * @returns {boolean} False if the client was not found, true otherwise.
 */
export function sendMessage(id, text) {
    const payload = {
        type: "server",
        text
    };

    if (typeof id === "string") {
        for (const [ws, info] of clients) {
            if (info.name === id) return sendToClient(ws, payload);
        }

        return false;
    }

    return sendToClient(id, payload);
}

export function registerClient(ws, rawName, NAME_REGEX) {
    const name = String(rawName ?? "").trim();

    if (clients.has(ws)) {
        kick(ws, "Already registered.");

        return false;
    }

    if (name.length === 0 || !NAME_REGEX.test(name)) {
        kick(ws, "Name must be 3–24 characters and contain only letters, numbers and underscore.");

        return false;
    }

    const taken = [...clients.values()].some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (taken) {
        kick(ws, "Name already taken.");

        return false;
    }

    clients.set(ws, {
        name,
        joinedAt: Date.now()
    });

    const joinEv = fireEvent("player.join", { name, ws });
    if (joinEv.isCancelled()) {
        clients.delete(ws);

        kick(ws, joinEv.data.kickReason ?? "Join denied by server.");
        return false;
    }

    sendToClient(ws, { type: "welcome" });
    sendToClient(ws, {
        type: "server",
        text: formatUserList()
    });

    return true;
}

export function unregisterClient(ws) {
    const client = clients.get(ws);

    if (client) {
        clients.delete(ws);

        fireEvent("player.leave", { name: client.name });
    }
}