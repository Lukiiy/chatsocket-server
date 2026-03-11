/**
 * An interface for commands!
 */
export class Command {
    /**
     * The method that will define what happens after running the command.
     * @param {*} ctx
     * @param {string[]} args
     */
    execute(ctx, args) { }

    /**
     * Whether the sender can use the command.
     * @param {*} ctx
     * @returns {boolean}
     */
    canUse(ctx) {
        return true;
    }
}

// Registry

const commands = new Map();

/**
 * Register a command.
 * @param {string} name A name for the command.
 * @param {Command} instance A {@link Command} instance for it.
 */
export function registerCommand(name, instance) {
    commands.set(name.toLowerCase(), instance);
}

/**
 * Get an already registered command.
 * @param {string} name The command's name.
 * @returns {Command|null} A {@link Command} instance, or null if not found.
 */
export function getCommand(name) {
    return commands.get(name.toLowerCase()) ?? null;
}

function dispatch(ctx, text) {
    const tokens = text.trim().slice(1).split(/\s+/);
    const cmd = commands.get(tokens[0].toLowerCase());

    if (!cmd) {
        ctx.reply("Unknown command.");
        return;
    }

    if (!cmd.canUse(ctx)) {
        ctx.reply("You can't use this command.");
        return;
    }

    try {
        cmd.execute(ctx, tokens.slice(1));
    } catch (err) {
        ctx.reply(`Command error: ${err.message}`);
    }
}

export function handleCommand(ws, senderName, text, channel) {
    dispatch({
        ws,
        name: senderName,
        broadcast: channel,
        reply: (t) => {
            try {
                ws.send(JSON.stringify({
                    type: "server",
                    text: t
                }));
            } catch { }
        },
    }, text);
}

export function executeAsServer(text, channel, reply) {
    dispatch({
        isServer: true,
        broadcast: channel,
        reply
    }, text);
}