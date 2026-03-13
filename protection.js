import { readFileSync } from "fs";
import { timingSafeEqual } from "crypto";

export let password = null;

export function loadPassword() {
    try {
        const fromFile = readFileSync("./password.txt", "utf8").trim();

        password = fromFile === "" ? null : fromFile;

        if (password != null) console.log("Password enabled.");
    } catch { }
}

export function checkPassword(input) {
    if (!password) return true;

    const inputBuf = Buffer.from(String(input ?? ""));
    const passBuf = Buffer.from(password);

    if (inputBuf.length !== passBuf.length) return false;

    return timingSafeEqual(inputBuf, passBuf);
}