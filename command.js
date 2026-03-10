/**
 * An interface for commands!
 */
export class Command {
    /**
     * The method that will define what happens after running the command.
     * @param {*} ctx
     * @param {*} args
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

export function registerCommand(name, instance) {
    commands.set(name.toLowerCase(), instance);
}

export function getCommand(name) {
    return commands.get(name.toLowerCase()) ?? null;
}

/**
 * Parse and dispatch a "/" message from a registered client.
 * Returns true if a command token was found (matched or not).
 */
export function handleCommand(ws, senderName, text, channel) {
    const tokens = text.trim().slice(1).split(/\s+/);

    const ctx = {
        ws,
        name: senderName,
        reply: (t) => {
            try {
                ws.send(JSON.stringify({
                    type: "server",
                    text: t
                }));
            } catch { }
        },
        broadcast: channel
    };

    const cmd = commands.get(tokens[0].toLowerCase());

    if (!cmd) {
        ctx.reply(`Unknown command.`);

        return true;
    }

    if (!cmd.canUse(ctx)) {
        ctx.reply("You can't use this command.");

        return true;
    }

    try {
        cmd.execute(ctx, tokens.slice(1));
    } catch (err) {
        ctx.reply(`Command error: ${err.message}`);
    }

    return true;
}
