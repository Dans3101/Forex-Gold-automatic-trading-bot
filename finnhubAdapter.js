// -----------------------------------------------------------------------------
// ⚡ Finnhub Gold Analyzer + EMA-Based Trading Adapter
// -----------------------------------------------------------------------------

import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";
import { telegramToken, telegramChatId } from "./config.js";

// -----------------------------------------------------------------------------
// ⚙️ CONFIGURATION
// -----------------------------------------------------------------------------
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const DEFAULT_BALANCE = 1000; // USD
const TRADE_HISTORY_LIMIT = 20; // keep last N trades
const SIGNAL_INTERVAL = 30 * 1000; // 30 seconds

let simulatedBalance = DEFAULT_BALANCE;
let openTrades = [];
let lastSignal = "HOLD";
let bot;

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
// ⚡ EMA CALCULATOR (Exponential Moving Average)
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
// 📊 Complex EMA Market Analyzer (14, 50, 200)
// -----------------------------------------------------------------------------
async function complexEMAAnalysis(apiKey, symbol = "XAUUSD") {
  const candles = await finnhubRequest("forex/candle", apiKey, {
    symbol,
    resolution: "5", // 5-minute candles
    count: 300,
  });

  if (!candles?.c) return { signal: "HOLD", reason: "No candle data" };

  const closes = candles.c;
  const ema14 = calculateEMA(closes, 14).at(-1);
  const ema50 = calculateEMA(closes, 50).at(-1);
  const ema200 = calculateEMA(closes, 200).at(-1);

  let signal = "HOLD";
  if (ema14 > ema50 && ema50 > ema200) signal = "BUY";
  else if (ema14 < ema50 && ema50 < ema200) signal = "SELL";

  return {
    signal,
    ema14: ema14.toFixed(2),
    ema50: ema50.toFixed(2),
    ema200: ema200.toFixed(2),
  };
}

// -----------------------------------------------------------------------------
// 💹 Simulated Trading Operations
// -----------------------------------------------------------------------------
async function getBalance() {
  return simulatedBalance;
}

async function getOpenTrades() {
  return openTrades;
}

async function openTrade(symbol = "XAUUSD", side = "buy", lotSize = 0.1, price) {
  const trade = {
    id: openTrades.length + 1,
    symbol,
    side,
    price,
    lotSize,
    time: new Date().toISOString(),
  };

  openTrades.push(trade);
  if (openTrades.length > TRADE_HISTORY_LIMIT) openTrades.shift();

  simulatedBalance -= lotSize * price * 0.01; // slight margin impact
  console.log(`📈 Trade opened: ${side.toUpperCase()} ${symbol} @ ${price}`);
  return trade;
}

async function closeTrade(tradeId, currentPrice) {
  const tradeIndex = openTrades.findIndex((t) => t.id === tradeId);
  if (tradeIndex === -1) throw new Error("Trade not found.");

  const trade = openTrades[tradeIndex];
  const profit =
    trade.side === "buy"
      ? (currentPrice - trade.price) * trade.lotSize * 10
      : (trade.price - currentPrice) * trade.lotSize * 10;

  simulatedBalance += profit;
  openTrades.splice(tradeIndex, 1);

  console.log(
    `💼 Closed Trade #${tradeId}: ${trade.symbol} | Profit: ${profit.toFixed(2)} USD`
  );
  return { trade, profit };
}

// -----------------------------------------------------------------------------
// 🚀 Start Finnhub Bot (with EMA signal updates)
// -----------------------------------------------------------------------------
export async function startFinnhubBot({ apiKey }) {
  if (!apiKey) throw new Error("Missing Finnhub API key.");

  console.log("🔌 Connecting to Finnhub API...");
  const quote = await finnhubRequest("quote", apiKey, { symbol: "XAUUSD" });

  if (quote?.c) {
    console.log(`✅ Connected to Finnhub | Current Gold Price: ${quote.c}`);
  } else {
    console.warn("⚠️ Running in simulation mode (no live data)");
  }

  // Initialize Telegram bot (optional)
  if (telegramToken && telegramChatId) {
    bot = new TelegramBot(telegramToken, { polling: false });
    console.log("🤖 Telegram bot connected for signal updates.");
  }

  // Start periodic analysis loop
  setInterval(async () => {
    const { signal, ema14, ema50, ema200 } = await complexEMAAnalysis(apiKey);
    if (!signal || signal === lastSignal) return;

    lastSignal = signal;

    const msg =
      `📊 *XAU/USD EMA Strategy Update*\n\n` +
      `EMA14: *${ema14}*\n` +
      `EMA50: *${ema50}*\n` +
      `EMA200: *${ema200}*\n\n` +
      `⚡ *Signal: ${signal}*`;

    console.log(`📈 New Signal: ${signal}`);

    if (bot && telegramChatId) {
      try {
        await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
      } catch (err) {
        console.error("⚠️ Telegram send error:", err.message);
      }
    }
  }, SIGNAL_INTERVAL);

  // Return API for external use
  return {
    getBalance,
    getOpenTrades,
    openTrade,
    closeTrade,
    analyzeMarket: () => complexEMAAnalysis(apiKey),
  };
}