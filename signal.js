// signal.js
import { getPocketSignals, getPocketData } from "./pocketscraper.js";

/**
 * Fetch signals from Pocket Option chat
 * @param {number} limit - max number of signals to fetch
 * @returns {Promise<Array>} signals
 */
export async function fetchSignals(limit = 5) {
  try {
    const signals = await getPocketSignals(limit);
    return signals.map((s, i) => ({
      id: i + 1,
      asset: s.asset || "UNKNOWN",
      decision: s.decision,
      strength: s.strength,
      raw: s.raw,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("❌ fetchSignals error:", err.message);
    return [];
  }
}

/**
 * Fetch market data from Pocket Option
 * @returns {Promise<Array>} assets with decision
 */
export async function fetchMarketData() {
  try {
    const data = await getPocketData();
    return data.map((d, i) => ({
      id: i + 1,
      asset: d.asset,
      decision: d.decision,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("❌ fetchMarketData error:", err.message);
    return [];
  }
}

// Quick test when run directly (node signal.js)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🔎 Testing signal.js functions...");

    const signals = await fetchSignals(3);
    console.log("✅ Signals:", signals);

    const market = await fetchMarketData();
    console.log("✅ Market Data:", market);
  })();
}