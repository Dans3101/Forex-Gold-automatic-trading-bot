// index.js
import "dotenv/config";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";
import { sendTelegramMessage } from "./botManager.js";

// How often to scrape (ms)
const INTERVAL = 60 * 1000; // every 1 minute

async function runScraper() {
  console.log("⏳ Running scraper cycle...");

  try {
    // 1. Get random PocketOption data (dummy)
    const data = await getPocketData();
    if (data.length) {
      for (const d of data) {
        const msg = `📊 Market Data → ${d.asset}: ${d.decision}`;
        console.log("➡️", msg);
        await sendTelegramMessage(msg);
      }
    } else {
      console.log("⚠️ No market data found this round.");
    }

    // 2. Get live chat signals
    const signals = await getPocketSignals({ onlyStrong: false, limit: 5 });
    if (signals.length) {
      for (const s of signals) {
        const msg = `📢 Signal (${s.strength}) → ${s.asset} : ${s.decision}\nRaw: ${s.raw}`;
        console.log("➡️", msg);
        await sendTelegramMessage(msg);
      }
    } else {
      console.log("⚠️ No signals extracted this round.");
    }
  } catch (err) {
    console.error("❌ Scraper cycle failed:", err.message);
  }

  console.log("✅ Cycle complete.\n");
}

// Run immediately once
runScraper();

// Repeat every INTERVAL
setInterval(runScraper, INTERVAL);