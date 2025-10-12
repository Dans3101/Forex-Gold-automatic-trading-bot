// strategies.js
import { SMA, BollingerBands, MACD } from "technicalindicators";

/**
 * This file defines trading strategies that analyze price candles and
 * return a signal: "BUY", "SELL", or "HOLD".
 * 
 * It supports both simulated and live MetaApi candle data.
 */

// --- Moving Average Crossover ---
export function movingAverageCrossover(data) {
  if (!data || data.length < 50) return "HOLD";
  const closes = data.map(c => c.close);

  const shortMA = SMA.calculate({ period: 10, values: closes });
  const longMA = SMA.calculate({ period: 30, values: closes });

  const shortNow = shortMA.at(-1);
  const longNow = longMA.at(-1);
  if (!shortNow || !longNow) return "HOLD";

  if (shortNow > longNow) return "BUY";
  if (shortNow < longNow) return "SELL";
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
  if (!data || data.length < 30) return "HOLD";
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
  if (!last) return "HOLD";

  if (last.MACD > last.signal) return "BUY";
  if (last.MACD < last.signal) return "SELL";
  return "HOLD";
}

// --- Trend Following (Simple Average) ---
export function trendFollowing(data) {
  if (!data || data.length < 15) return "HOLD";
  const closes = data.map(c => c.close);
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const lastPrice = closes.at(-1);

  if (lastPrice > avg) return "BUY";
  if (lastPrice < avg) return "SELL";
  return "HOLD";
}

// --- Support/Resistance Breakout ---
export function supportResistance(data) {
  if (!data || data.length < 40) return "HOLD";
  const closes = data.map(c => c.close);
  const recent = closes.slice(-20);

  const support = Math.min(...recent);
  const resistance = Math.max(...recent);
  const lastPrice = closes.at(-1);

  if (lastPrice <= support) return "BUY"; // bounce from support
  if (lastPrice >= resistance) return "SELL"; // rejection at resistance
  return "HOLD";
}

// --- Combined Signal ---
export function combinedDecision(data) {
  const results = [
    movingAverageCrossover(data),
    bollingerBands(data),
    macdStrategy(data),
    trendFollowing(data),
    supportResistance(data),
  ];

  const buyCount = results.filter(r => r === "BUY").length;
  const sellCount = results.filter(r => r === "SELL").length;

  if (buyCount > sellCount) return "BUY";
  if (sellCount > buyCount) return "SELL";
  return "HOLD";
}

/**
 * Unified Strategy Application
 * 
 * @param {string} strategyName - name from config (e.g. "movingAverage")
 * @param {object} adapter - ExnessAdapter or MetaApi adapter instance
 * @param {string} symbol - trading pair symbol (e.g. "XAUUSD")
 */
export async function applyStrategy(strategyName, adapter, symbol) {
  try {
    // Fetch last 100 candles
    const candles = await adapter.fetchHistoricCandles(symbol, "1m", 100);
    if (!candles || candles.length === 0) {
      console.warn("⚠️ No candle data available for", symbol);
      return "HOLD";
    }

    let decision;
    switch (strategyName) {
      case "movingAverage":
        decision = movingAverageCrossover(candles);
        break;
      case "bollinger":
        decision = bollingerBands(candles);
        break;
      case "macd":
        decision = macdStrategy(candles);
        break;
      case "trend":
        decision = trendFollowing(candles);
        break;
      case "supportResistance":
        decision = supportResistance(candles);
        break;
      default:
        decision = combinedDecision(candles);
    }

    console.log(`📊 Strategy '${strategyName}' decision for ${symbol}: ${decision}`);
    return decision;
  } catch (err) {
    console.error("❌ Strategy execution failed:", err.message);
    return "HOLD";
  }
}

// -----------------------------------------------------------------------------
// 🔍 Self-test mode — run `node strategies.js` directly to test
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const fakeData = Array.from({ length: 100 }, (_, i) => ({
    time: Date.now() - i * 60000,
    open: 1900 + Math.sin(i / 5) * 10,
    high: 1910 + Math.sin(i / 5) * 10,
    low: 1890 + Math.sin(i / 5) * 10,
    close: 1900 + Math.sin(i / 5) * 10 + Math.random() * 5,
  }));

  console.log("🧠 Running local strategy tests...");
  console.log("MA:", movingAverageCrossover(fakeData));
  console.log("BB:", bollingerBands(fakeData));
  console.log("MACD:", macdStrategy(fakeData));
  console.log("Trend:", trendFollowing(fakeData));
  console.log("Combined:", combinedDecision(fakeData));
}