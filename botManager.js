// botManager.js
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { groupId } from "./config.js";
import { getPocketData } from "./pocketscraper.js";

let isBotOn = false;
let signalInterval;

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // shows QR if no session yet
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp bot connected");
    }
  });

  // 📩 Handle group messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const from = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // Only listen inside the configured group
    if (from === groupId) {
      if (body.toLowerCase() === ".on") {
        if (!isBotOn) {
          isBotOn = true;
          await sock.sendMessage(groupId, {
            text: "🤖 Trading signals bot *activated*! Sending 1 random signal every 5 minutes...",
          });

          signalInterval = setInterval(async () => {
            const results = await getPocketData();

            if (results.length > 0) {
              // Pick a random asset from scraped list
              const randomIndex = Math.floor(Math.random() * results.length);
              const r = results[randomIndex];

              // Send asset name first
              await sock.sendMessage(groupId, {
                text: `📊 Asset: ${r.asset}`,
              });

              // Wait 30 seconds ⏳
              await new Promise((resolve) => setTimeout(resolve, 30 * 1000));

              // Send decision
              await sock.sendMessage(groupId, {
                text: `📌 Decision: ${r.decision}`,
              });
            } else {
              await sock.sendMessage(groupId, {
                text: "⚠️ No signals available right now.",
              });
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