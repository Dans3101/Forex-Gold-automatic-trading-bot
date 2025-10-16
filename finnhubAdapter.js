// finnhubAdapter.js
// -----------------------------------------------------------------------------
// 🔹 Finnhub Gold Analyzer + Trading Adapter (improved signal detection)
// -----------------------------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { config, telegramToken, telegramChatId } from "./config.js";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const bot = new TelegramBot(telegramToken, { polling: false });

// Simulated account state
let simulatedBalance = 1000;
let openTrades = [];

// -----------------------------------------------------------------------------
// ✅ Get real-time Gold price
// -----------------------------------------------------------------------------
async function getGoldPrice() {
  try {
    const res = await fetch(`${FINNHUB_BASE_URL}/quote?symbol=XAUUSD&token=${FINNHUB_API_KEY}`);
    const data = await res.json();
    if (!data.c) throw new Error("No price data from Finnhub");
    return data.c;
  } catch (err) {
    console.error("❌ Error fetching price:", err.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// ✅ SMA & RSI calculation helpers
// -----------------------------------------------------------------------------
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period || 1;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// -----------------------------------------------------------------------------
// ✅ Market Analyzer
// -----------------------------------------------------------------------------
let priceHistory = [];
let lastSignal = "HOLD";
let trend = "NEUTRAL";

async function analyzeMarket() {
  const price = await getGoldPrice();
  if (!price) return;

  priceHistory.push(price);
  if (priceHistory.length > 300) priceHistory.shift();

  const smaShort = calculateSMA(priceHistory, 5);
  const smaLong = calculateSMA(priceHistory, 20);
  const rsi = calculateRSI(priceHistory, 14);

  if (!smaShort || !smaLong || !rsi) {
    console.log("⏳ Collecting price history...");
    return;
  }

  // --- Improved decision logic ---
  let signal = "HOLD";

  if (smaShort > smaLong && rsi > 50 && rsi < 70) {
    signal = "BUY";
    trend = "BULLISH";
  } else if (smaShort < smaLong && rsi < 50 && rsi > 30) {
    signal = "SELL";
    trend = "BEARISH";
  }

  // Overbought / oversold zones
  if (rsi >= 70) signal = "OVERBOUGHT ⚠ SELL SOON";
  if (rsi <= 30) signal = "OVERSOLD ⚠ BUY SOON";

  // If no signal, keep the last known trend
  if (signal === "HOLD" && trend === "BULLISH") signal = "STAY IN BUY";
  if (signal === "HOLD" && trend === "BEARISH") signal = "STAY IN SELL";

  // Send update only when signal changes
  if (signal !== lastSignal) {
    lastSignal = signal;
    const msg =
      `📊 *Gold (XAU/USD) Signal*\n\n` +
      `💵 Price: *${price.toFixed(2)}*\n` +
      `📈 SMA-5: *${smaShort.toFixed(2)}*\n` +
      `📉 SMA-20: *${smaLong.toFixed(2)}*\n` +
      `📊 RSI-14: *${rsi.toFixed(2)}*\n\n` +
      `⚡ *Signal: ${signal}*`;

    try {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
      console.log(`✅ Sent new signal: ${signal}`);
    } catch (err) {
      console.error("⚠️ Telegram error:", err.message);
    }
  } else {
    console.log(`📍 ${signal} | Price: ${price.toFixed(2)} | RSI: ${rsi.toFixed(1)}`);
  }
}

// -----------------------------------------------------------------------------
// ✅ Candle History Fetcher (for better start-up accuracy)
// -----------------------------------------------------------------------------
export async function fetchHistoricCandles(symbol = "XAUUSD", resolution = "1", limit = 100) {
  try {
    const res = await fetch(
      `${FINNHUB_BASE_URL}/forex/candle?symbol=${symbol}&resolution=${resolution}&count=${limit}&token=${FINNHUB_API_KEY}`
    );
    const data = await res.json();
    if (!data?.c) return [];

    priceHistory = data.c.slice(-100); // warm up with recent candles
    console.log("📈 Loaded initial candle history:", priceHistory.length);
    return priceHistory;
  } catch (err) {
    console.error("❌ Error fetching candles:", err.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// ✅ Simulated Trade System
// -----------------------------------------------------------------------------
async function getBalance() {
  return simulatedBalance;
}

async function placeTrade(symbol, side, lotSize = config.lotSize) {
  const trade = {
    id: Date.now(),
    symbol,
    side,
    price: priceHistory.at(-1),
    lotSize,
    time: new Date().toISOString(),
  };
  openTrades.push(trade);
  console.log(`📈 Simulated trade opened: ${side} ${symbol}`);
  return trade;
}

// -----------------------------------------------------------------------------
// ✅ Start Analyzer
// -----------------------------------------------------------------------------
export async function startFinnhubBot() {
  console.log("🚀 Finnhub Gold Analyzer (refresh every 30s)");
  await fetchHistoricCandles(); // preload
  analyzeMarket();
  setInterval(analyzeMarket, 30 * 1000);
  return adapterAPI;
}

// -----------------------------------------------------------------------------
// ✅ Export Adapter API
// -----------------------------------------------------------------------------
const adapterAPI = {
  getBalance,
  placeTrade,
  fetchHistoricCandles,
};

export default adapterAPI;