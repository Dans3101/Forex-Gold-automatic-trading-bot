// botManager.js
import makeWASocket, {
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import readline from "readline";
import { groupId } from "./config.js";
import { getPocketData } from "./pocketscraper.js";

let isRunning = false; // toggle for signals
let sock; // WhatsApp socket instance

// ========== Utility: Input Prompt ==========
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

// ========== WhatsApp Connection ==========
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, null),
    },
    printQRInTerminal: false, // we are not using QR
    browser: Browsers.macOS("Desktop"),
  });

  sock.ev.on("creds.update", saveCreds);

  // Connection status
  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;
    if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");
    } else if (connection === "close") {
      console.log("❌ Connection closed, reconnecting...");
      startBot();
    }
  });

  // 🔑 Linking Code Login
  if (!state.creds.registered) {
    const phoneNumber = await askQuestion(
      "📱 Enter your WhatsApp phone number (e.g., 2547XXXXXXXX): "
    );
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`🔗 Your WhatsApp Linking Code: ${code}`);
    console.log("👉 Enter this in WhatsApp: Linked Devices > Link a Device");
  }

  // ========== Listen for Commands ==========
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (from === groupId) {
      if (text.toLowerCase() === ".on") {
        if (!isRunning) {
          isRunning = true;
          await sock.sendMessage(groupId, {
            text: "✅ Trading signals *activated*!",
          });
          startSignalLoop();
        }
      } else if (text.toLowerCase() === ".off") {
        isRunning = false;
        await sock.sendMessage(groupId, {
          text: "🛑 Trading signals *stopped*!",
        });
      }
    }
  });
}

// ========== Trading Signal Loop ==========
async function startSignalLoop() {
  while (isRunning) {
    // ⏳ Wait 30s before decision
    await delay(30000);

    // 📊 Get market data from Pocket Option
    const marketData = await getPocketData();
    const decision = marketData.decision || "HOLD";

    const signal = `📊 *Trading Signal*  
Asset: EUR/USD  
Decision: ${decision}  
Time: ${new Date().toLocaleTimeString()}`;

    await sock.sendMessage(groupId, { text: signal });
    console.log("✅ Sent signal:", signal);

    // Wait 5 minutes before next signal
    await delay(5 * 60 * 1000);
  }
}