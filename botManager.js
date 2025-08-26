import { getMarketData } from "./pocketScraper.js";
import { groupId, email, password } from "./config.js";
import technicalindicators from "technicalindicators";
import { delay } from "@whiskeysockets/baileys";

async function sendTradingSignal(sock) {
  let signalsOn = false;

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || !msg.key.remoteJid.includes(groupId)) return;

    const text = msg.message.conversation?.trim();

    if (text === ".on") {
      signalsOn = true;
      await sock.sendMessage(groupId, { text: "✅ Signals started." });
    }

    if (text === ".off") {
      signalsOn = false;
      await sock.sendMessage(groupId, { text: "🛑 Signals stopped." });
    }
  });

  while (true) {
    if (signalsOn) {
      const prices = await getMarketData(email, password);
      if (prices.length < 30) {
        console.log("⚠️ Not enough data fetched");
        await delay(5000);
        continue;
      }

      const rsi = technicalindicators.RSI.calculate({ values: prices, period: 14 });
      const lastRSI = rsi[rsi.length - 1];

      let decision = "";
      if (lastRSI < 30) decision = "BUY (RSI Oversold)";
      else if (lastRSI > 70) decision = "SELL (RSI Overbought)";
      else {
        const ema9 = technicalindicators.EMA.calculate({ values: prices, period: 9 });
        const ema21 = technicalindicators.EMA.calculate({ values: prices, period: 21 });
        decision = ema9[ema9.length - 1] > ema21[ema21.length - 1]
          ? "BUY (EMA Crossover)"
          : "SELL (EMA Crossover)";
      }

      const signal = `📊 *Pocket Option Signal*  
Asset: EUR/USD  
Decision: ${decision}  
Time: ${new Date().toLocaleTimeString()}`;

      await sock.sendMessage(groupId, { text: signal });
      console.log("✅ Signal sent:", signal);
    }

    await delay(5 * 60 * 1000); // Wait 5 minutes before next signal
  }
}