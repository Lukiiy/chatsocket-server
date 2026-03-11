/**
 * Represents an event. Passed to every handler.
 */
export class Event {
    /**
     * @param {string} name The event name.
     * @param {object} data Mutable event data.
     */
    constructor(name, data) {
        this.name = name;
        this.data = data;
        this.cancelled = false;
    }

    /**
     * Cancels the event.
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * @param {boolean} value
     */
    setCancelled(value) {
        this.cancelled = !!value;
    }

    /**
     * @returns {boolean}
     */
    isCancelled() {
        return this.cancelled;
    }
}

const listeners = {};

/**
 * Registers a handler for an event.
 * @param {string} name
 * @param {function(Event): void} handler
 * @param {number} priority Lower priority runs first. Defaults to 10.
 */
export function registerEvent(name, handler, priority = 10) {
    if (!listeners[name]) listeners[name] = [];

    listeners[name].push({ priority, handler });
    listeners[name].sort((a, b) => a.priority - b.priority);
}

/**
 * Triggers an event, running all registered handlers in priority order.
 * @param {string} name
 * @param {object} data
 * @returns {Event}
 */
export function fireEvent(name, data) {
    const event = new Event(name, data);
    const handlers = listeners[name] ?? [];

    for (const { handler } of handlers) {
        handler(event);

        if (event.cancelled) break;
    }

    return event;
}

export { listeners as eventListeners };