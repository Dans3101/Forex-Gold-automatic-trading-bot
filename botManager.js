import makeWASocket, { useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import fs from "fs";
import technicalindicators from "technicalindicators"; // 📊 for RSI/EMA calculations
import { groupId } from "./config.js"; // groupId stored in config.js

// ====== Load or Create Session ======
export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  // ✅ Bot connected
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot connected to WhatsApp");
      sendTradingSignal(sock);
    }
  });
}

// ====== Trading Signal Generator ======
async function sendTradingSignal(sock) {
  while (true) {
    // 1️⃣ Fake market data (replace with real API later)
    const prices = Array.from({ length: 50 }, () => (Math.random() * 100 + 100).toFixed(2)).map(Number);

    // 2️⃣ RSI Strategy
    const rsi = technicalindicators.RSI.calculate({ values: prices, period: 14 });
    const lastRSI = rsi[rsi.length - 1];

    let decision = "";
    if (lastRSI < 30) decision = "BUY (RSI Oversold)";
    else if (lastRSI > 70) decision = "SELL (RSI Overbought)";
    else {
      // 3️⃣ EMA Strategy
      const ema9 = technicalindicators.EMA.calculate({ values: prices, period: 9 });
      const ema21 = technicalindicators.EMA.calculate({ values: prices, period: 21 });

      const lastEMA9 = ema9[ema9.length - 1];
      const lastEMA21 = ema21[ema21.length - 1];

      decision = lastEMA9 > lastEMA21 ? "BUY (EMA Crossover)" : "SELL (EMA Crossover)";
    }

    // 4️⃣ Candlestick Pattern Check
    const lastCandle = prices[prices.length - 1] - prices[prices.length - 2];
    if (Math.abs(lastCandle) > 0.5) {
      decision += lastCandle > 0 ? " | Bullish Candle" : " | Bearish Candle";
    }

    // 5️⃣ Format message
    const signal = `📊 *Trading Signal*  
Asset: EUR/USD  
Decision: ${decision}  
Time: ${new Date().toLocaleTimeString()}`;

    // 6️⃣ Send to WhatsApp group
    await sock.sendMessage(groupId, { text: signal });

    console.log("✅ Signal sent:", signal);

    // Wait 30 seconds before sending next signal
    await delay(30000);
  }
}