// botManager.js
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { groupId } from "./config.js";
import { getPocketData } from "./pocketscraper.js";

let isBotOn = false;
let signalInterval;

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // will later switch to phone number + code
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp bot connected");
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
            text: "🤖 Trading signals bot *activated*! Generating signals every 5 minutes...",
          });

          signalInterval = setInterval(async () => {
            const results = await getPocketData();

            await sock.sendMessage(groupId, { text: "📊 Pocket Option Signals\n\n" });

            for (let r of results) {
              // Step 1: Send asset name
              await sock.sendMessage(groupId, { text: `📌 ${r.asset}` });

              // Step 2: Wait 30 seconds ⏳
              await new Promise(resolve => setTimeout(resolve, 30000));

              // Step 3: Send decision
              await sock.sendMessage(groupId, { text: `➡️ ${r.decision}\n` });
            }
          }, 5 * 60 * 1000); // every 5 minutes
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