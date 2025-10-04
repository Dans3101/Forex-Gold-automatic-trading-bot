// strategies.js
import technicalindicators from "technicalindicators";

// --- Moving Average Crossover ---
export function movingAverageCrossover(data) {
  if (data.length < 50) return "HOLD";
  const closes = data.map(c => c.close);
  const shortMA = technicalindicators.SMA.calculate({ period: 10, values: closes });
  const longMA = technicalindicators.SMA.calculate({ period: 30, values: closes });

  if (shortMA[shortMA.length - 1] > longMA[longMA.length - 1]) return "BUY";
  if (shortMA[shortMA.length - 1] < longMA[longMA.length - 1]) return "SELL";
  return "HOLD";
}

// --- Bollinger Bands ---
export function bollingerBands(data) {
  if (data.length < 20) return "HOLD";
  const closes = data.map(c => c.close);
  const bb = technicalindicators.BollingerBands.calculate({
    period: 20, values: closes, stdDev: 2
  });

  const last = bb[bb.length - 1];
  const price = closes[closes.length - 1];

  if (price < last.lower) return "BUY";
  if (price > last.upper) return "SELL";
  return "HOLD";
}

// --- MACD Strategy ---
export function macdStrategy(data) {
  if (data.length < 30) return "HOLD";
  const closes = data.map(c => c.close);
  const macd = technicalindicators.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const last = macd[macd.length - 1];
  if (!last) return "HOLD";

  if (last.MACD > last.signal) return "BUY";
  if (last.MACD < last.signal) return "SELL";
  return "HOLD";
}

// --- Trend Following (Simple) ---
export function trendFollowing(data) {
  if (data.length < 15) return "HOLD";
  const closes = data.map(c => c.close);
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const lastPrice = closes[closes.length - 1];

  if (lastPrice > avg) return "BUY";
  if (lastPrice < avg) return "SELL";
  return "HOLD";
}

// --- Support / Resistance Breakout ---
export function supportResistance(data) {
  if (data.length < 40) return "HOLD";
  const closes = data.map(c => c.close);
  const recent = closes.slice(-20);

  const support = Math.min(...recent);
  const resistance = Math.max(...recent);
  const lastPrice = closes[closes.length - 1];

  if (lastPrice <= support) return "BUY";   // bounce from support
  if (lastPrice >= resistance) return "SELL"; // rejection at resistance
  return "HOLD";
}

// --- Combined Decision ---
export function combinedDecision(data) {
  const results = [
    movingAverageCrossover(data),
    bollingerBands(data),
    macdStrategy(data),
    trendFollowing(data),
    supportResistance(data)
  ];

  const buyCount = results.filter(r => r === "BUY").length;
  const sellCount = results.filter(r => r === "SELL").length;

  if (buyCount > sellCount) return "BUY";
  if (sellCount > buyCount) return "SELL";
  return "HOLD";
}

// --- Alias for exnessBot.js ---
export const applyStrategy = combinedDecision;