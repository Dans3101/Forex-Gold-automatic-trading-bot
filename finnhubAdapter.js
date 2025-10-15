// finnhubAdapter.js
// -----------------------------------------------------------
// 🔹 Real-Time Gold Signal Bot using Finnhub API + Telegram 🔹
// -----------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { config, telegramToken, telegramChatId } from "./config.js";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const bot = new TelegramBot(telegramToken, { polling: false });

// -----------------------------------------------------------
// 🔸 Fetch latest XAU/USD (Gold) price
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// 🔸 Moving Average (SMA) Calculator
// -----------------------------------------------------------
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// -----------------------------------------------------------
// 🔸 RSI (Relative Strength Index) Calculator
// -----------------------------------------------------------
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period || 1; // prevent divide by zero
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// -----------------------------------------------------------
// 🔸 Market Analysis Logic
// -----------------------------------------------------------
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

  let signal = "HOLD";

  // ---------------------------------------------------------
  // 🔹 Signal Logic (Combines SMA Cross + RSI)
  // ---------------------------------------------------------
  if (smaShort > smaLong && rsi < 70 && rsi > 40) signal = "BUY";
  else if (smaShort < smaLong && rsi > 30 && rsi < 60) signal = "SELL";

  if (rsi > 75) signal = "OVERBOUGHT ⚠ SELL SOON";
  if (rsi < 25) signal = "OVERSOLD ⚠ BUY SOON";

  // ---------------------------------------------------------
  // 🔔 Send Telegram Notification (Only on Change)
  // ---------------------------------------------------------
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

// -----------------------------------------------------------
// 🔸 Start Real-Time Analysis (every 30 seconds)
// -----------------------------------------------------------
export function startFinnhubBot() {
  console.log("🚀 Finnhub Gold Analyzer started (interval: 30s)");
  analyzeMarket(); // run immediately at start
  setInterval(analyzeMarket, 30 * 1000);
}