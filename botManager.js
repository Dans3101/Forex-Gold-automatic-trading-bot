import makeWASocket, { useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import fs from "fs";
import { generateSignal } from "./strategy.js";
import config from "./config.json" assert { type: "json" };

let sock;
let running = false; // to control .on / .off
let signalInterval;  // store interval ID

export async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveCreds);

    // Handle messages from group
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // Check only group messages
        if (from === config.groupId && text) {
            if (text.toLowerCase() === ".on") {
                if (!running) {
                    running = true;
                    await sock.sendMessage(from, { text: "✅ Bot started! Signals will be sent every 5 minutes." });
                    startSignalLoop(from);
                }
            } else if (text.toLowerCase() === ".off") {
                if (running) {
                    running = false;
                    clearInterval(signalInterval);
                    await sock.sendMessage(from, { text: "🛑 Bot stopped!" });
                }
            }
        }
    });
}

function startSignalLoop(groupId) {
    signalInterval = setInterval(async () => {
        if (!running) return;

        // Generate a fake signal (you can enhance strategy.js later)
        const { asset, decision } = generateSignal();

        // Step 1: Send asset
        await sock.sendMessage(groupId, { text: `📊 Asset: ${asset}` });

        // Step 2: Wait 30 seconds, then send decision
        await delay(30000);
        await sock.sendMessage(groupId, { text: `📈 Decision: ${decision}` });

    }, 5 * 60 * 1000); // 5 minutes interval
}