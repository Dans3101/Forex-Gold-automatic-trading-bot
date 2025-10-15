// -----------------------------------------------------------------------------
// strategies.js
// Intelligent Trading Strategy Module (for Finnhub / Exness bots)
// -----------------------------------------------------------------------------

import { SMA, BollingerBands, MACD } from "technicalindicators";

/**
 * This module combines multiple technical indicators (MA, MACD, Bollinger)
 * to produce clear, timely BUY/SELL/HOLD signals using live candle data.
 */

// --- Moving Average Crossover ---
export function movingAverageCrossover(data) {
  if (!data || data.length < 50) return "HOLD";
  const closes = data.map(c => c.close);

  const shortMA = SMA.calculate({ period: 10, values: closes });
  const longMA = SMA.calculate({ period: 30, values: closes });

  const shortNow = shortMA.at(-1);
  const longNow = longMA.at(-1);
  const prevShort = shortMA.at(-2);
  const prevLong = longMA.at(-2);

  if (!shortNow || !longNow || !prevShort || !prevLong) return "HOLD";

  // Crossover detection
  if (prevShort <= prevLong && shortNow > longNow) return "BUY";
  if (prevShort >= prevLong && shortNow < longNow) return "SELL";

  return "HOLD";
}

// --- Bollinger Bands ---
export function bollingerBands(data) {
  if (!data || data.length < 20) return "HOLD";
  const closes = data.map(c => c.close);

  const bb = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });

  const last = bb.at(-1);
  const price = closes.at(-1);
  if (!last) return "HOLD";

  // Price below lower band → possible reversal up
  if (price < last.lower) return "BUY";
  // Price above upper band → possible reversal down
  if (price > last.upper) return "SELL";

  return "HOLD";
}

// --- MACD Strategy ---
export function macdStrategy(data) {
  if (!data || data.length < 35) return "HOLD";
  const closes = data.map(c => c.close);

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const last = macd.at(-1);
  const prev = macd.at(-2);
  if (!last || !prev) return "HOLD";

  // Crossovers
  if (prev.MACD <= prev.signal && last.MACD > last.signal) return "BUY";
  if (prev.MACD >= prev.signal && last.MACD < last.signal) return "SELL";

  return "HOLD";
}

// --- Trend Momentum (simple) ---
export function trendMomentum(data) {
  if (!data || data.length < 15) return "HOLD";
  const closes = data.map(c => c.close);

  const last = closes.at(-1);
  const prev = closes.at(-2);
  const diff = ((last - prev) / prev) * 100;

  // Significant move thresholds
  if (diff > 0.15) return "BUY";
  if (diff < -0.15) return "SELL";
  return "HOLD";
}

// --- Support/Resistance Breakout ---
export function supportResistance(data) {
  if (!data || data.length < 40) return "HOLD";
  const closes = data.map(c => c.close);
  const recent = closes.slice(-25);

  const support = Math.min(...recent);
  const resistance = Math.max(...recent);
  const lastPrice = closes.at(-1);

  if (lastPrice <= support * 1.002) return "BUY"; // bounce
  if (lastPrice >= resistance * 0.998) return "SELL"; // rejection
  return "HOLD";
}

// --- Combined Decision Logic ---
export function combinedDecision(data) {
  const results = [
    movingAverageCrossover(data),
    macdStrategy(data),
    bollingerBands(data),
    trendMomentum(data),
    supportResistance(data),
  ];

  const buyCount = results.filter(r => r === "BUY").length;
  const sellCount = results.filter(r => r === "SELL").length;

  if (buyCount > sellCount + 1) return "BUY";
  if (sellCount > buyCount + 1) return "SELL";
  return "HOLD";
}

/**
 * ✅ Unified Strategy Selector
 * Called directly from exnessBot.js
 */
export async function applyStrategy(candles) {
  try {
    if (!candles || candles.length < 30) return "HOLD";

    // Main combined logic
    const signal = combinedDecision(candles);

    console.log(`📊 Strategy decision: ${signal}`);
    return signal;
  } catch (err) {
    console.error("❌ Strategy execution failed:", err.message);
    return "HOLD";
  }
}

// -----------------------------------------------------------------------------
// 🔍 Self-test mode — run with `node strategies.js`
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const fakeData = Array.from({ length: 100 }, (_, i) => ({
    time: Date.now() - i * 60000,
    open: 1900 + Math.sin(i / 5) * 10,
    high: 1910 + Math.sin(i / 5) * 10,
    low: 1890 + Math.sin(i / 5) * 10,
    close: 1900 + Math.sin(i / 5) * 10 + Math.random() * 5,
  }));

  console.log("🧠 Strategy test...");
  console.log("→ Combined Decision:", combinedDecision(fakeData));
}