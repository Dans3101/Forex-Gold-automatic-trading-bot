// botManager.js

// ✅ Core modules
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ✅ WhatsApp client (Baileys v6+)
import baileys from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode"; // ✅ Generate PNG QR code

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

// ✅ Config (env variables)
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

// Logs
console.log("🚀 Bot Manager loaded...");
console.log("📞 WhatsApp Phone:", phoneNumber || "❌ Not set");
console.log("👥 Group ID:", groupId || "❌ Not set");
console.log("📧 Pocket Option Email:", email || "❌ Not set");

let isBotOn = false;
let signalInterval;
let latestQR = null; // 🔑 store QR as base64

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "auth_info_baileys")
  );
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // ❌ disable terminal QR
  });

  sock.ev.on("creds.update", saveCreds);

  // 📌 Connection events
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📲 New QR generated, available at /qr");
      latestQR = await qrcode.toDataURL(qr); // save QR as base64 image
    }

    if (connection === "open") {
      console.log("✅ WhatsApp bot connected");
      latestQR = null; // clear QR once logged in
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("♻️ Reconnecting...");
        startBot();
      } else {
        console.log("❌ Logged out. Please redeploy to scan new QR.");
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

              await sock.sendMessage(groupId, { text: `📊 Asset: ${r.asset}` });

              await new Promise((resolve) =>
                setTimeout(resolve, decisionDelaySeconds * 1000)
              );

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

// ✅ Export latest QR for index.js
export function getLatestQR() {
  return latestQR;
}