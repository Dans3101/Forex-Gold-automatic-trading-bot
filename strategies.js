// -----------------------------------------------------------------------------
// strategies.js
// Intelligent Trading Strategy Module (for Finnhub / Exness bots)
// -----------------------------------------------------------------------------

import { SMA, EMA, RSI, BollingerBands, MACD } from "technicalindicators";

/**
 * Multi-indicator confirmation system.
 * Uses MA crossover, MACD, Bollinger, RSI, EMA trend, and support/resistance
 * to produce strong BUY / SELL / HOLD signals.
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

  if (price < last.lower) return "BUY";
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

  if (prev.MACD <= prev.signal && last.MACD > last.signal) return "BUY";
  if (prev.MACD >= prev.signal && last.MACD < last.signal) return "SELL";
  return "HOLD";
}

// --- RSI + EMA Confirmation (Trend Strength Detector) ---
export function rsiEmaTrend(data) {
  if (!data || data.length < 30) return "HOLD";
  const closes = data.map(c => c.close);

  const rsi = RSI.calculate({ values: closes, period: 14 });
  const emaShort = EMA.calculate({ values: closes, period: 9 });
  const emaLong = EMA.calculate({ values: closes, period: 21 });

  const latestRSI = rsi.at(-1);
  const prevRSI = rsi.at(-2);
  const latestShort = emaShort.at(-1);
  const latestLong = emaLong.at(-1);
  const prevShort = emaShort.at(-2);
  const prevLong = emaLong.at(-2);

  if (!latestRSI || !latestShort || !latestLong || !prevShort || !prevLong) return "HOLD";

  const bullishCross = prevShort < prevLong && latestShort > latestLong;
  const bearishCross = prevShort > prevLong && latestShort < latestLong;

  if (bullishCross && latestRSI > 55 && latestRSI > prevRSI) return "BUY";
  if (bearishCross && latestRSI < 45 && latestRSI < prevRSI) return "SELL";
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

  if (lastPrice <= support * 1.002) return "BUY";
  if (lastPrice >= resistance * 0.998) return "SELL";
  return "HOLD";
}

// --- Volatility Filter (ignores low-movement zones) ---
function volatilityLow(data) {
  const closes = data.map(c => c.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const rangePercent = ((high - low) / low) * 100;
  return rangePercent < 0.15; // less than 0.15% = flat
}

// --- Weighted Combined Decision ---
export function combinedDecision(data) {
  if (!data || data.length < 50) return "HOLD";

  if (volatilityLow(data)) {
    console.log("⚠️ Low volatility detected — holding.");
    return "HOLD";
  }

  const signals = {
    ma: movingAverageCrossover(data),
    macd: macdStrategy(data),
    boll: bollingerBands(data),
    rsiEma: rsiEmaTrend(data),
    sr: supportResistance(data),
  };

  const weights = {
    ma: 2,
    macd: 2,
    boll: 1,
    rsiEma: 3, // strongest weight
    sr: 1,
  };

  let score = 0;
  for (const [key, signal] of Object.entries(signals)) {
    if (signal === "BUY") score += weights[key];
    if (signal === "SELL") score -= weights[key];
  }

  // Decision thresholds
  if (score >= 4) return "BUY";
  if (score <= -4) return "SELL";
  return "HOLD";
}

/**
 * ✅ Unified Strategy Selector
 * Called directly from exnessBot.js
 */
export async function applyStrategy(candles) {
  try {
    if (!candles || candles.length < 30) return "HOLD";

    const signal = combinedDecision(candles);
    console.log(`🧠 Strategy decision: ${signal}`);
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

  console.log("🧠 Strategy self-test...");
  console.log("→ Combined Decision:", combinedDecision(fakeData));
}