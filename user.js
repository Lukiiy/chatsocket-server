import { fireEvent } from "./event.js";

export const clients = new Map(); // websocket ( user, joinedAt )

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

export function broadcast(payload, exclude = null) {
    const msg = JSON.stringify(payload);

    for (const [ws] of clients) {
        if (ws !== exclude && ws.readyState === 1) ws.send(msg);
    }
}

export function sendUserList(ws) {
    const names = [...clients.values()].map((c) => c.name);
    const payload = {
        type: "userlist",
        users: names
    };

    return sendToClient(ws, payload);
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

export function sendMessage(name, payload) {
    for (const [ws, info] of clients) {
        if (info.name === name) return sendToClient(ws, payload);
    }

    return false;
}

export function registerClient(ws, raw_name, NAME_REGEX) {
    const name = String(raw_name ?? "").trim();

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

    clients.set(ws, { name, joinedAt: Date.now() });

    const joinEv = fireEvent("player.join", { name, ws });
    if (joinEv.isCancelled()) {
        clients.delete(ws);

        kick(ws, joinEv.data.kickReason ?? "Join denied by server.");
        return false;
    }

    sendUserList(ws);
    return true;
}

export function unregisterClient(ws) {
    const client = clients.get(ws);

    if (client) {
        clients.delete(ws);

        fireEvent("player.leave", { name: client.name });
    }
}