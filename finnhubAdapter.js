// FinnhubAdapter.js
// -----------------------------------------------------------
// 🔹 Real-Time Gold Signal Bot using Finnhub API + Telegram 🔹
// -----------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { config, telegramToken, telegramChatId } from "./config.js";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

// ✅ Initialize Telegram bot (non-polling mode)
const bot = new TelegramBot(telegramToken, { polling: false });

// -----------------------------------------------------------
// 🔸 Helper: Fetch latest XAU/USD (Gold) price
// -----------------------------------------------------------
async function getGoldPrice() {
  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=XAUUSD&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();

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
// 🔸 Helper: Calculate Simple Moving Average
// -----------------------------------------------------------
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

// -----------------------------------------------------------
// 🔸 Market Analysis Logic
// -----------------------------------------------------------
let priceHistory = [];
let lastSignal = null;

async function analyzeMarket() {
  const priceData = await getGoldPrice();
  if (!priceData) return;

  const price = priceData.current;
  priceHistory.push(price);
  if (priceHistory.length > 200) priceHistory.shift(); // limit memory

  const smaShort = calculateSMA(priceHistory, 5);
  const smaLong = calculateSMA(priceHistory, 20);

  if (!smaShort || !smaLong) return; // wait for enough data

  let signal = null;

  if (smaShort > smaLong && lastSignal !== "BUY") {
    signal = "BUY";
    lastSignal = "BUY";
  } else if (smaShort < smaLong && lastSignal !== "SELL") {
    signal = "SELL";
    lastSignal = "SELL";
  }

  // ---------------------------------------------------------
  // 🔔 Send Signal to Telegram
  // ---------------------------------------------------------
  if (signal) {
    const message =
      `📊 *Gold Signal Triggered!*\n\n` +
      `💰 Symbol: *XAU/USD*\n` +
      `📈 Current Price: *${price.toFixed(2)}*\n` +
      `📊 Short SMA (5): *${smaShort.toFixed(2)}*\n` +
      `📊 Long SMA (20): *${smaLong.toFixed(2)}*\n\n` +
      `🟩 *Signal: ${signal}*`;

    await bot.sendMessage(telegramChatId, message, { parse_mode: "Markdown" });
    console.log(`✅ Sent ${signal} signal to Telegram`);
  } else {
    console.log(`📉 No signal yet | Price: ${price}`);
  }
}

// -----------------------------------------------------------
// 🔸 Start Real-Time Monitoring (every 30 seconds)
// -----------------------------------------------------------
export function startFinnhubBot() {
  console.log("🚀 Finnhub Signal Bot started (interval: 30s)");
  setInterval(analyzeMarket, 30 * 1000);
}

// -----------------------------------------------------------
// 🔹 Optional Quick Test Mode
// -----------------------------------------------------------
if (process.env.NODE_ENV === "test") {
  (async () => {
    console.log(await getGoldPrice());
  })();
}