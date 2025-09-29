// testScraper.js
import fs from "fs";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";
import { signalIntervalMinutes } from "./config.js";

console.log("🧪 Test Scraper starting...");
console.log(`⏳ Will scrape every ${signalIntervalMinutes} minutes`);

// Helper to save raw chat logs
function saveChatLog(signals) {
  if (!signals || signals.length === 0) return;

  const timestamp = new Date().toISOString();
  const logLines = signals.map(
    (sig) =>
      `[${timestamp}] (${sig.strength}) Asset: ${sig.asset}, Decision: ${sig.decision}, Raw: ${sig.raw}`
  );

  fs.appendFileSync("chat-log.txt", logLines.join("\n") + "\n", "utf-8");
  console.log(`📝 Saved ${signals.length} signals to chat-log.txt`);
}

// Main loop
async function runScraper() {
  try {
    console.log("\n🔍 Running PocketOption test scrape...");

    // 1. Market Data
    const data = await getPocketData();
    if (data.length > 0) {
      for (const d of data) {
        console.log(
          `📊 Market Data -> Asset: ${d.asset}, Decision: ${d.decision}`
        );
      }
    } else {
      console.log("ℹ️ No market data found this cycle.");
    }

    // 2. Live Chat Signals
    const signals = await getPocketSignals({ onlyStrong: false, limit: 5 });
    if (signals.length > 0) {
      for (const sig of signals) {
        console.log(
          `📢 Chat Signal (${sig.strength}) -> Asset: ${sig.asset}, Decision: ${sig.decision}, Raw: ${sig.raw}`
        );
      }
      // Save to file
      saveChatLog(signals);
    } else {
      console.log("ℹ️ No chat signals found this cycle.");
    }

    console.log("✅ Scrape cycle complete.");
  } catch (err) {
    console.error("❌ Error during scrape:", err.message);
  }
}

// Run immediately, then repeat every N minutes
runScraper();
setInterval(runScraper, signalIntervalMinutes * 60 * 1000);