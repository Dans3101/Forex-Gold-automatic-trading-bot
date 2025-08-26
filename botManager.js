import makeWASocket, { useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import technicalindicators from "technicalindicators"; // 📊 RSI/EMA
import { groupId } from "./config.js"; // ✅ Group ID stored in config.js

let isBotActive = false; // ON/OFF switch

// ====== Start Bot ======
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  // ✅ Connection Update
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
    }
  });

  // ✅ Listen for commands in group
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    if (msg.key.remoteJid === groupId) {
      if (text.toLowerCase() === ".on") {
        isBotActive = true;
        await sock.sendMessage(groupId, { text: "✅ Signals Activated (every 5 minutes)" });
        generateSignals(sock); // start generating signals
      } else if (text.toLowerCase() === ".off") {
        isBotActive = false;
        await sock.sendMessage(groupId, { text: "🛑 Signals Deactivated" });
      }
    }
  });
}

// ====== Signal Generator ======
async function generateSignals(sock) {
  while (isBotActive) {
    // 1️⃣ Announce asset first
    const asset = "EUR/USD"; // later can randomize assets
    await sock.sendMessage(groupId, { text: `📢 New Signal Incoming...\nAsset: ${asset}` });

    // Wait 30 sec before decision
    await delay(30000);

    // 2️⃣ Generate fake price data
    const prices = Array.from({ length: 50 }, () => (Math.random() * 100 + 100).toFixed(2)).map(Number);

    // 3️⃣ RSI Strategy
    const rsi = technicalindicators.RSI.calculate({ values: prices, period: 14 });
    const lastRSI = rsi[rsi.length - 1];

    let decision = "";
    if (lastRSI < 30) decision = "BUY (RSI Oversold)";
    else if (lastRSI > 70) decision = "SELL (RSI Overbought)";
    else {
      // EMA Strategy
      const ema9 = technicalindicators.EMA.calculate({ values: prices, period: 9 });
      const ema21 = technicalindicators.EMA.calculate({ values: prices, period: 21 });

      const lastEMA9 = ema9[ema9.length - 1];
      const lastEMA21 = ema21[ema21.length - 1];

      decision = lastEMA9 > lastEMA21 ? "BUY (EMA Crossover)" : "SELL (EMA Crossover)";
    }

    // 4️⃣ Candlestick Pattern
    const lastCandle = prices[prices.length - 1] - prices[prices.length - 2];
    if (Math.abs(lastCandle) > 0.5) {
      decision += lastCandle > 0 ? " | Bullish Candle" : " | Bearish Candle";
    }

    // 5️⃣ Final message
    const signal = `📊 *Trading Signal*  
Asset: ${asset}  
Decision: ${decision}  
Time: ${new Date().toLocaleTimeString()}`;

    await sock.sendMessage(groupId, { text: signal });
    console.log("✅ Signal sent:", signal);

    // 6️⃣ Wait 5 minutes before next signal
    for (let i = 0; i < 300; i += 5) {
      if (!isBotActive) break; // exit loop if turned off
      await delay(5000);
    }
  }
}