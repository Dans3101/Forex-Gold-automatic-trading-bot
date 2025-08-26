import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import { Boom } from "@hapi/boom";
import config from "./config.json" assert { type: "json" };

// 🔹 Load group ID from config.json
const GROUP_ID = config.group_id; // example: "1234567890-123456@g.us"

export async function startBot() {
  // 🔐 Store session so QR not needed every time
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  // ⚡ Start the socket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // QR shows only the first time
  });

  // 🔄 Listen for connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("connection closed due to", lastDisconnect?.error, ", reconnecting:", shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp!");
    }
  });

  // 🔑 Save credentials whenever updated
  sock.ev.on("creds.update", saveCreds);

  // 📩 Function to send trading signals
  async function sendSignal(asset, direction) {
    const message = `📊 *Trading Signal*\n\nAsset: ${asset}\nAction: *${direction.toUpperCase()}*\n⏳ Valid for 30s`;
    await sock.sendMessage(GROUP_ID, { text: message });
    console.log("✅ Signal sent to group:", GROUP_ID);
  }

  // ⏱️ Example: Send random signals every 60 seconds
  setInterval(() => {
    const assets = ["EUR/USD", "GBP/JPY", "BTC/USDT", "XAU/USD"];
    const directions = ["buy", "sell"];

    const asset = assets[Math.floor(Math.random() * assets.length)];
    const direction = directions[Math.floor(Math.random() * directions.length)];

    sendSignal(asset, direction);
  }, 60_000); // every 1 minute
}