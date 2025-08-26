import makeWASocket, { useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import { getTradingSignal } from "./pocketScraper.js";
import { groupId } from "./config.js";
import fs from "fs";

let botRunning = false;
let intervalId = null;

// ====== Start Bot ======
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  // ✅ Connection handler
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
    }
  });

  // ✅ Listen for commands
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid) return;

    const from = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

    // Only respond inside the configured group
    if (from !== groupId) return;

    if (text.toLowerCase() === ".on") {
      if (botRunning) {
        await sock.sendMessage(groupId, { text: "⚡ Bot is already running." });
        return;
      }
      botRunning = true;
      await sock.sendMessage(groupId, { text: "✅ Trading bot activated. Signals will be sent every 5 minutes." });

      // Start interval for signals
      intervalId = setInterval(async () => {
        const signal = await getTradingSignal();
        if (signal) {
          const msg = `📊 *Trading Signal*  
Asset: ${signal.asset}  
Decision: ${signal.decision}  
Time: ${signal.time}`;
          await sock.sendMessage(groupId, { text: msg });
          console.log("✅ Signal sent:", msg);
        } else {
          await sock.sendMessage(groupId, { text: "⚠️ Failed to fetch signal." });
        }
      }, 5 * 60 * 1000); // every 5 min
    }

    if (text.toLowerCase() === ".off") {
      if (!botRunning) {
        await sock.sendMessage(groupId, { text: "❌ Bot is already stopped." });
        return;
      }
      botRunning = false;
      clearInterval(intervalId);
      await sock.sendMessage(groupId, { text: "🛑 Trading bot stopped." });
    }
  });
}