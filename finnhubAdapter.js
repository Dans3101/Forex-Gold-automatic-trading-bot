// -----------------------------------------------------------------------------
// ⚡ Finnhub Gold Analyzer + Enhanced EMA-Based Signal Bot (Telegram Only)
// -----------------------------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { telegramToken, telegramChatId } from "./config.js";

// -----------------------------------------------------------------------------
// ⚙️ CONFIGURATION
// -----------------------------------------------------------------------------
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const SIGNAL_INTERVAL = 30 * 1000; // every 30s
const CONFIRMATION_ROUNDS = 2; // confirm signal consistency
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes between alerts

let bot;
let lastSignal = "HOLD";
let confirmationCount = 0;
let lastAlertTime = 0;

// -----------------------------------------------------------------------------
// 🔹 Helper: Finnhub API Request
// -----------------------------------------------------------------------------
async function finnhubRequest(endpoint, apiKey, params = {}) {
  const url = new URL(`${FINNHUB_BASE_URL}/${endpoint}`);
  url.searchParams.set("token", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`❌ Finnhub API Error (${endpoint}):`, err.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// ⚡ EMA CALCULATOR
// -----------------------------------------------------------------------------
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  return prices.reduce((acc, price, i) => {
    if (i === 0) return [price];
    const ema = price * k + acc[i - 1] * (1 - k);
    return [...acc, ema];
  }, []);
}

// -----------------------------------------------------------------------------
// 📊 Triple EMA Market Analysis (14, 50, 200)
// -----------------------------------------------------------------------------
async function analyzeEMAStructure(apiKey, symbol = "XAUUSD") {
  const candles = await finnhubRequest("forex/candle", apiKey, {
    symbol,
    resolution: "5", // 5-minute interval
    count: 300,
  });

  if (!candles?.c) return { signal: "HOLD", reason: "No candle data" };

  const closes = candles.c;
  const ema14 = calculateEMA(closes, 14).at(-1);
  const ema50 = calculateEMA(closes, 50).at(-1);
  const ema200 = calculateEMA(closes, 200).at(-1);

  let signal = "HOLD";
  let trend = "Neutral";

  // 🔹 Determine trend direction
  if (ema14 > ema50 && ema50 > ema200) {
    signal = "BUY";
    trend = "Uptrend Forming ✅";
  } else if (ema14 < ema50 && ema50 < ema200) {
    signal = "SELL";
    trend = "Downtrend Forming ⚠️";
  } else if (ema14 > ema50 && ema50 < ema200) {
    signal = "POSSIBLE REVERSAL (BUY)";
    trend = "Potential Reversal 📈";
  } else if (ema14 < ema50 && ema50 > ema200) {
    signal = "POSSIBLE REVERSAL (SELL)";
    trend = "Potential Reversal 📉";
  }

  return {
    signal,
    trend,
    ema14: ema14.toFixed(2),
    ema50: ema50.toFixed(2),
    ema200: ema200.toFixed(2),
  };
}

// -----------------------------------------------------------------------------
// 🚀 Start Finnhub Bot (Telegram Alerts Only)
// -----------------------------------------------------------------------------
export async function startFinnhubBot({ apiKey }) {
  if (!apiKey) throw new Error("Missing Finnhub API key.");

  console.log("🔌 Connecting to Finnhub...");
  const quote = await finnhubRequest("quote", apiKey, { symbol: "XAUUSD" });
  if (quote?.c) console.log(`✅ Connected | Current Gold Price: ${quote.c}`);
  else console.warn("⚠️ No live price data, continuing in analysis mode...");

  // Initialize Telegram bot
  if (telegramToken && telegramChatId) {
    bot = new TelegramBot(telegramToken, { polling: false });
    console.log("🤖 Telegram alerts enabled.");
  }

  // Periodic signal check
  setInterval(async () => {
    const { signal, trend, ema14, ema50, ema200 } = await analyzeEMAStructure(apiKey);

    if (!signal || signal === "HOLD") {
      console.log("⏳ Waiting for clear trend...");
      return;
    }

    // Confirm consistent signal
    if (signal === lastSignal) confirmationCount++;
    else confirmationCount = 1;

    // Check cooldown
    const now = Date.now();
    const cooldownPassed = now - lastAlertTime >= COOLDOWN_TIME;

    // Only send if confirmed and cooldown passed
    if (confirmationCount >= CONFIRMATION_ROUNDS && cooldownPassed) {
      const message =
        `📊 *Gold EMA Strategy Alert*\n\n` +
        `💰 *XAU/USD*\n` +
        `EMA14: *${ema14}*\n` +
        `EMA50: *${ema50}*\n` +
        `EMA200: *${ema200}*\n\n` +
        `📈 *Trend:* ${trend}\n` +
        `⚡ *Signal:* ${signal}`;

      console.log(`🚀 Sending Telegram alert: ${signal}`);

      if (bot && telegramChatId) {
        try {
          await bot.sendMessage(telegramChatId, message, { parse_mode: "Markdown" });
          lastAlertTime = now;
        } catch (err) {
          console.error("⚠️ Telegram send error:", err.message);
        }
      }

      lastSignal = signal;
    } else {
      console.log(`📉 Signal detected (${signal}) — waiting for confirmation (${confirmationCount}/${CONFIRMATION_ROUNDS})`);
    }
  }, SIGNAL_INTERVAL);

  console.log("🚀 Finnhub Gold Analyzer running...");
  return { analyzeEMAStructure };
}