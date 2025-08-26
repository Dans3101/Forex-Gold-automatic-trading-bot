import makeWASocket, {
  useMultiFileAuthState,
  delay
} from "@whiskeysockets/baileys";
import fs from "fs";

async function startBot() {
  // Load/save authentication (so you don’t scan QR every time)
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true // shows QR only on first login
  });

  sock.ev.on("creds.update", saveCreds);

  // Load group ID from config.json
  let config = JSON.parse(fs.readFileSync("./config.json"));
  const GROUP_ID = config.groupId;

  // ✅ Helper: log group IDs when bot is added
  sock.ev.on("groups.upsert", async (groups) => {
    for (let g of groups) {
      console.log("📌 New group found:");
      console.log("Name:", g.subject);
      console.log("Group ID:", g.id);
    }
  });

  // ✅ Example: send random signals every 30 seconds
  const strategies = [
    "EUR/USD BUY for 1m",
    "GBP/JPY SELL for 5m",
    "AUD/CAD BUY for 1m",
    "Gold SELL for 15m",
    "BTC/USD BUY for 5m"
  ];

  async function sendRandomSignal() {
    let signal = strategies[Math.floor(Math.random() * strategies.length)];
    await sock.sendMessage(GROUP_ID, { text: `📊 New Signal: ${signal}` });
    console.log("✅ Sent:", signal);
  }

  // Send one immediately, then repeat every 30s
  sendRandomSignal();
  setInterval(sendRandomSignal, 30000);
}

startBot();