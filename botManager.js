// botManager.js
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import { groupId } from "./config.js";
import { getSignal } from "./pocketScraper.js"; // 📊 get signal from Pocket Option scraper

let botActive = false; // 🔘 on/off switch

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false // ❌ no QR, we’ll use pairing code
  });

  // 🔹 Generate pairing code if first login
  if (!state.creds || !state.creds.me) {
    const phoneNumber = "2547XXXXXXXX"; // 👉 replace with your WhatsApp number
    const code = await sock.requestPairingCode(phoneNumber);
    console.log("📲 Enter this code in WhatsApp Linked Devices:", code);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
    }
  });

  // 🔹 Listen for group commands
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const from = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // Only respond inside the target group
    if (from === groupId) {
      if (body.toLowerCase() === ".on") {
        botActive = true;
        await sock.sendMessage(groupId, { text: "✅ Bot turned ON" });
        generateSignals(sock);
      } else if (body.toLowerCase() === ".off") {
        botActive = false;
        await sock.sendMessage(groupId, { text: "⛔ Bot turned OFF" });
      }
    }
  });
}

// ====== Signal Loop ======
async function generateSignals(sock) {
  while (botActive) {
    // 1️⃣ Get signal from Pocket Option scraper
    const signal = await getSignal();

    // 2️⃣ Send signal to WhatsApp group
    await sock.sendMessage(groupId, { text: signal });
    console.log("✅ Signal sent:", signal);

    // 3️⃣ Wait 5 minutes before sending next signal
    for (let i = 0; i < 30; i++) {
      if (!botActive) break; // stop immediately if turned off
      await delay(10000); // check every 10s (total 5 min = 30×10s)
    }
  }
}