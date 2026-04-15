import { readFileSync, existsSync } from "fs";
import { timingSafeEqual } from "crypto";
import { execFileSync } from "child_process";

export let password = null;
export let tls = null;

export function loadPassword() {
    try {
        const fromFile = readFileSync("./password.txt", "utf8").trim();

        password = fromFile === '' ? null : fromFile;

        if (password != null) console.log("Password enabled.");
    } catch { }
}

export function checkPassword(input) {
    if (!password) return true;

    const inputBuf = Buffer.from(String(input ?? ''));
    const passBuf = Buffer.from(password);

    if (inputBuf.length !== passBuf.length) return false;

    return timingSafeEqual(inputBuf, passBuf);
}

export function loadTLS() {
    if (process.argv.includes("--no-encryption")) return;

    if (!existsSync("./cert.pem") || !existsSync("./key.pem")) {
        console.log("Generating self-signed certificate...");

        execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-keyout", "key.pem", "-out", "cert.pem", "-days", "365", "-nodes", "-subj", "/CN=ChatSocket"], { stdio: "ignore" });
    }

    tls = {
        cert: readFileSync("./cert.pem"),
        key: readFileSync("./key.pem")
    };

    console.log("Encryption enabled.");
}