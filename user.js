import { fireEvent } from "./event.js";

export const clients = new Map(); // websocket ( user, joinedAt )

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
        ws.send(JSON.stringify({
            type: "error",
            text: "Already registered."
        }));

        return false;
    }

    if (name.length === 0 || !NAME_REGEX.test(name)) {
        ws.send(
            JSON.stringify({
                type: "name_rejected",
                reason: "Name must be 3–24 characters and contain only letters, numbers and underscore.",
            })
        );

        try {
            ws.close();
        } catch { }

        return false;
    }

    const taken = [...clients.values()].some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (taken) {
        ws.send(
            JSON.stringify({
                type: "name_rejected",
                reason: "Name already taken.",
            })
        );

        try {
            ws.close();
        } catch { }

        return false;
    }

    clients.set(ws, { name, joinedAt: Date.now() });
    ws.send(JSON.stringify({
        type: "name_accepted",
        name
    }));

    const joinEv = fireEvent("player.join", { name, ws });
    if (joinEv.isCancelled()) {
        clients.delete(ws);

        try {
            ws.send(JSON.stringify({
                type: "error",
                text: "Join cancelled by server."
            }));
        } catch { }

        try {
            ws.close();
        } catch { }

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