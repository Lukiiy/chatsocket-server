export class Event {
    constructor(name, data) {
        this.name = name;
        this.data = data;
        this.cancelled = false;
    }

    cancel() {
        this.cancelled = true;
    }

    setCancelled(value) {
        this.cancelled = !!value;
    }

    isCancelled() {
        return this.cancelled;
    }
}

const eventListeners = {};

export function registerEvent(eventName, handler, priority = 10) {
    if (!eventListeners[eventName]) eventListeners[eventName] = [];

    eventListeners[eventName].push({ priority, handler });
    eventListeners[eventName].sort((a, b) => a.priority - b.priority);
}

export function fireEvent(eventName, data) {
    const ev = new Event(eventName, data);
    const listeners = eventListeners[eventName] ?? [];

    for (const { handler } of listeners) {
        handler(ev);

        if (ev.cancelled) break;
    }

    return ev;
}

export { eventListeners };