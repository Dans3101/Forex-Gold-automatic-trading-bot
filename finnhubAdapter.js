// finnhubAdapter.js
// -----------------------------------------------------------------------------
// 🔹 Finnhub Gold Analyzer + Trading Adapter (with simulated balance/trades)
// -----------------------------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { config, telegramToken, telegramChatId } from "./config.js";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

const bot = new TelegramBot(telegramToken, { polling: false });

// Simulated account state
let simulatedBalance = 1000; // USD
let openTrades = [];

// -----------------------------------------------------------------------------
// ✅ Fetch latest XAU/USD (Gold) price
// -----------------------------------------------------------------------------
async function getGoldPrice() {
  try {
    const res = await fetch(`${FINNHUB_BASE_URL}/quote?symbol=XAUUSD&token=${FINNHUB_API_KEY}`);
    const data = await res.json();
    if (!data.c) throw new Error("No price data returned from Finnhub");

    return {
      current: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
    };
  } catch (err) {
    console.error("❌ Error fetching gold price:", err.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// ✅ SMA (Simple Moving Average)
// -----------------------------------------------------------------------------
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// -----------------------------------------------------------------------------
// ✅ RSI (Relative Strength Index)
// -----------------------------------------------------------------------------
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period || 1; // avoid divide by zero
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// -----------------------------------------------------------------------------
// ✅ Market Analyzer
// -----------------------------------------------------------------------------
let priceHistory = [];
let lastSignal = "HOLD";

async function analyzeMarket() {
  const priceData = await getGoldPrice();
  if (!priceData) return;

  const price = priceData.current;
  priceHistory.push(price);
  if (priceHistory.length > 300) priceHistory.shift();

  const smaShort = calculateSMA(priceHistory, 5);
  const smaLong = calculateSMA(priceHistory, 20);
  const rsi = calculateRSI(priceHistory, 14);

  if (!smaShort || !smaLong || !rsi) {
    console.log("⏳ Collecting data... waiting for enough candles");
    return;
  }

  // Basic combined logic
  let signal = "HOLD";

  if (smaShort > smaLong && rsi < 70 && rsi > 40) signal = "BUY";
  else if (smaShort < smaLong && rsi > 30 && rsi < 60) signal = "SELL";

  if (rsi > 75) signal = "OVERBOUGHT ⚠ SELL SOON";
  if (rsi < 25) signal = "OVERSOLD ⚠ BUY SOON";

  // If signal changes, notify via Telegram
  if (signal !== lastSignal) {
    lastSignal = signal;

    const message =
      `📊 *Gold Market Update*\n\n` +
      `💰 Symbol: *XAU/USD*\n` +
      `💵 Current Price: *${price.toFixed(2)}*\n` +
      `📈 Short SMA (5): *${smaShort.toFixed(2)}*\n` +
      `📉 Long SMA (20): *${smaLong.toFixed(2)}*\n` +
      `📊 RSI (14): *${rsi.toFixed(2)}*\n\n` +
      `📢 *Signal: ${signal}*`;

    try {
      await bot.sendMessage(telegramChatId, message, { parse_mode: "Markdown" });
      console.log(`✅ Signal sent to Telegram: ${signal}`);
    } catch (err) {
      console.error("⚠️ Failed to send Telegram message:", err.message);
    }
  } else {
    console.log(`📍 HOLD | Price: ${price.toFixed(2)} | RSI: ${rsi.toFixed(1)}`);
  }
}

// -----------------------------------------------------------------------------
// ✅ Adapter Methods for External Use (index.js & strategies.js)
// -----------------------------------------------------------------------------
export async function startFinnhubBot() {
  console.log("🚀 Finnhub Gold Analyzer started (interval: 30s)");
  analyzeMarket(); // run immediately
  setInterval(analyzeMarket, 30 * 1000);
  return adapterAPI;
}

export async function fetchHistoricCandles(symbol = "XAUUSD", interval = "1m", limit = 100) {
  const res = await fetch(
    `${FINNHUB_BASE_URL}/forex/candle?symbol=${symbol}&resolution=${interval}&count=${limit}&token=${FINNHUB_API_KEY}`
  );
  const data = await res.json();

  if (!data?.c) {
    console.warn("⚠️ No candle data from Finnhub");
    return [];
  }

  return data.c.map((close, i) => ({
    time: data.t[i] * 1000,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close,
  }));
}

// -----------------------------------------------------------------------------
// ✅ Simulated Account / Trade Management
// -----------------------------------------------------------------------------
async function getBalance() {
  return simulatedBalance;
}

async function getOpenTrades() {
  return openTrades;
}

async function placeTrade(symbol, side, lotSize = config.lotSize) {
  const trade = {
    id: Date.now(),
    symbol,
    side,
    price: priceHistory.at(-1),
    lotSize,
    timestamp: new Date().toISOString(),
  };
  openTrades.push(trade);
  console.log(`📈 Simulated trade opened: ${side} ${symbol}`);
  return trade;
}

// -----------------------------------------------------------------------------
// ✅ Export Adapter Object
// -----------------------------------------------------------------------------
const adapterAPI = {
  getBalance,
  getOpenTrades,
  placeTrade,
  fetchHistoricCandles,
};

export default adapterAPI;