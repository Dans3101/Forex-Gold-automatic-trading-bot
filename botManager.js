// botManager.js

// ✅ Core modules
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ✅ WhatsApp client
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

// ✅ Config (environment variables from config.js)
import {
  phoneNumber,
  groupId,
  email,
  password,
  signalIntervalMinutes,
  decisionDelaySeconds,
} from "./config.js";

// ✅ Pocket Option scraper
import { getPocketData } from "./pocketscraper.js";

// Utils
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs for debugging env vars
console.log("🚀 Bot Manager loaded...");
console.log("📞 WhatsApp Phone:", phoneNumber || "❌ Not set");
console.log("👥 Group ID:", groupId || "❌ Not set");
console.log("📧 Pocket Option Email:", email || "❌ Not set");

let isBotOn = false;
let signalInterval;

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "auth_info_baileys")
  );
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // QR disabled (pairing code instead)
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp bot connected");
    } else if (update.qr) {
      console.log("⚠️ QR login disabled. Use pairing code method.");
    } else if (update.isNewLogin) {
      console.log("🔗 Bot linked successfully!");
    }
  });

  // 📌 Pairing code if not registered yet
  if (!state.creds.registered) {
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(
        `📲 Enter this code in WhatsApp (Linked Devices > Link with phone number): ${code}`
      );
    } catch (err) {
      console.error("❌ Failed to get pairing code:", err);
    }
  }

  // 📩 Handle messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const from = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (from === groupId) {
      if (body.toLowerCase() === ".on") {
        if (!isBotOn) {
          isBotOn = true;
          await sock.sendMessage(groupId, {
            text: `🤖 Trading signals bot *activated*! Sending 1 random signal every ${signalIntervalMinutes} minutes...`,
          });

          signalInterval = setInterval(async () => {
            const results = await getPocketData();

            if (results.length > 0) {
              const randomIndex = Math.floor(Math.random() * results.length);
              const r = results[randomIndex];

              // send asset name
              await sock.sendMessage(groupId, { text: `📊 Asset: ${r.asset}` });

              // wait before sending decision
              await new Promise((resolve) =>
                setTimeout(resolve, decisionDelaySeconds * 1000)
              );

              // send decision
              await sock.sendMessage(groupId, {
                text: `📌 Decision: ${r.decision}`,
              });
            } else {
              await sock.sendMessage(groupId, {
                text: "⚠️ No signals available right now.",
              });
            }
          }, signalIntervalMinutes * 60 * 1000);
        }
      } else if (body.toLowerCase() === ".off") {
        if (isBotOn) {
          clearInterval(signalInterval);
          isBotOn = false;
          await sock.sendMessage(groupId, {
            text: "⛔ Trading signals bot *stopped*!",
          });
        }
      }
    }
  });
}