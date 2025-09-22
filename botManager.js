// botManager.js

// ✅ Core modules
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ✅ WhatsApp client (Baileys v6+ requires default import)
import baileys from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal"; // 🔑 For QR display in logs

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

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
    printQRInTerminal: true, // ✅ Enable QR method
  });

  sock.ev.on("creds.update", saveCreds);

  // 📌 Connection events
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📲 Scan this QR code with WhatsApp:");
      qrcode.generate(qr, { small: true }); // ✅ Display QR in Render logs
    }

    if (connection === "open") {
      console.log("✅ WhatsApp bot connected");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("♻️ Reconnecting...");
        startBot();
      } else {
        console.log("❌ Logged out. Please redeploy and scan QR again.");
      }
    }
  });

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