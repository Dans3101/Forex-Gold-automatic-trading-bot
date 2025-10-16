// -----------------------------------------------------------------------------
// exnessBot.js
// Live Gold Trading Bot — Auto Trend Detection using Finnhub + RSI + EMA
// -----------------------------------------------------------------------------

import { config } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { EMA, RSI } from "technicalindicators"; // ✅ npm install technicalindicators
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;
let lastDecision = "HOLD";
let lastPrice = null;
let errorCount = 0;

// ✅ Initialize Finnhub Adapter
const adapter = new ExnessAdapter({
  apiKey: process.env.FINNHUB_API_KEY,
  useSimulation: false,
});

/**
 * ✅ Safe Telegram message sender
 */
async function safeSend(bot, chatId, text, options = {}) {
  try {
    if (!bot || !chatId) return;
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.error("⚠️ Telegram send error:", err.message);
  }
}

/**
 * ✅ Trend Detector using RSI and EMA
 */
function detectTrend(candles) {
  const closes = candles.map((c) => parseFloat(c.close));

  // Calculate RSI and EMAs
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const emaShort = EMA.calculate({ values: closes, period: 9 });
  const emaLong = EMA.calculate({ values: closes, period: 21 });

  const latestRSI = rsiValues.at(-1);
  const prevRSI = rsiValues.at(-2);
  const latestShort = emaShort.at(-1);
  const latestLong = emaLong.at(-1);
  const prevShort = emaShort.at(-2);
  const prevLong = emaLong.at(-2);

  // Detect EMA crossover
  const emaBullish = prevShort < prevLong && latestShort > latestLong;
  const emaBearish = prevShort > prevLong && latestShort < latestLong;

  // Combine RSI + EMA
  if (emaBullish && latestRSI > 55 && latestRSI > prevRSI) return "BUY";
  if (emaBearish && latestRSI < 45 && latestRSI < prevRSI) return "SELL";

  return "HOLD";
}

/**
 * ✅ Core trading logic loop
 */
async function tradingLoop(bot, chatId) {
  try {
    const marketOpen = await adapter.isMarketOpen();
    if (!marketOpen) {
      console.log("⏸ Market closed — waiting...");
      return;
    }

    const [price, candles, balance] = await Promise.all([
      adapter.getPrice(config.asset),
      adapter.fetchHistoricCandles(config.asset),
      adapter.getBalance(),
    ]);

    if (!price || !candles?.length) {
      throw new Error("Invalid candle data from Finnhub.");
    }

    // Auto trend detection
    const trendDecision = detectTrend(candles);
    const strategyDecision = await applyStrategy(candles);

    // Confirm only if both agree
    const finalDecision =
      trendDecision === strategyDecision ? trendDecision : "HOLD";

    console.log(
      `📊 ${config.asset} | ${finalDecision} | Price: ${price.toFixed(2)} | Balance: ${balance.toFixed(2)}`
    );

    // Trigger trades only if new confirmed signal
    if (finalDecision !== lastDecision && (finalDecision === "BUY" || finalDecision === "SELL")) {
      lastDecision = finalDecision;

      const order = await adapter.placeOrder({
        symbol: config.asset,
        side: finalDecision,
        lotSize: config.lotSize,
      });

      if (order.success) {
        await safeSend(
          bot,
          chatId,
          `🚨 *${finalDecision} SIGNAL CONFIRMED!*\n\n` +
            `💱 Asset: *${config.asset}*\n` +
            `💹 Price: *${price.toFixed(2)}*\n` +
            `💰 Balance: *${balance.toFixed(2)} USD*\n` +
            `📦 Lot: *${config.lotSize}*\n` +
            `📊 RSI: *${trendDecision === "BUY" ? "Bullish (>55)" : "Bearish (<45)"}*\n` +
            `⚙️ Strategy: *${config.strategy}*`,
          { parse_mode: "Markdown" }
        );
      }
    }

    // Occasional update when price moves a lot
    if (!lastPrice || Math.abs(price - lastPrice) / lastPrice > 0.002) {
      await safeSend(
        bot,
        chatId,
        `📈 *Market Update*\n\n` +
          `💱 Asset: *${config.asset}*\n` +
          `💹 Price: *${price.toFixed(2)}*\n` +
          `🧭 Decision: *${finalDecision}*\n` +
          `💰 Balance: *${balance.toFixed(2)} USD*`,
        { parse_mode: "Markdown" }
      );
      lastPrice = price;
    }

    await adapter.simulateProfitLoss();
    errorCount = 0;
  } catch (err) {
    console.error("❌ Trading loop error:", err.message);
    errorCount++;
    if (errorCount > 3) {
      console.log("⚠️ Too many errors — reconnecting...");
      await adapter.connect();
      errorCount = 0;
    }
  }
}

/**
 * ✅ Start Trading Bot
 */
async function startExnessBot(bot, chatId) {
  if (botActive) {
    await safeSend(bot, chatId, "⚠️ Bot is already running.");
    return;
  }

  botActive = true;
  console.log("🚀 Starting Exness Bot (Finnhub + Trend Detection)...");
  await safeSend(bot, chatId, "🚀 Starting trading bot with auto-trend detection...");

  const connected = await adapter.connect();
  if (!connected) {
    await safeSend(bot, chatId, "❌ Failed to connect to Finnhub API. Check your API key.");
    botActive = false;
    return;
  }

  await safeSend(bot, chatId, "✅ Connected to Finnhub API. Monitoring live gold prices...");
  console.log("✅ Connected to Finnhub API.");

  intervalId = setInterval(async () => {
    if (botActive) await tradingLoop(bot, chatId);
  }, 30000);
}

/**
 * ✅ Stop Bot
 */
async function stopExnessBot(bot, chatId) {
  if (!botActive) {
    await safeSend(bot, chatId, "⚠️ Bot is not running.");
    return;
  }

  botActive = false;
  clearInterval(intervalId);
  intervalId = null;

  console.log("🛑 Bot stopped.");
  await safeSend(bot, chatId, "🛑 Bot stopped manually.");
}

/**
 * ✅ Telegram Command Handlers
 */
function setupTelegramHandlers(bot) {
  bot.onText(/\/startbot/, (msg) => startExnessBot(bot, msg.chat.id));
  bot.onText(/\/stopbot/, (msg) => stopExnessBot(bot, msg.chat.id));

  bot.onText(/\/status/, async (msg) => {
    try {
      const connected = adapter.connected;
      const balance = await adapter.getBalance();
      const price = await adapter.getPrice(config.asset);
      const marketOpen = await adapter.isMarketOpen();

      const statusMsg =
        `🛰 *Bot Status*\n\n` +
        `🔗 Connection: *${connected ? "Connected ✅" : "Disconnected ❌"}*\n` +
        `🧠 Strategy: *${config.strategy}*\n` +
        `💱 Asset: *${config.asset}*\n` +
        `💹 Price: *${price.toFixed(2)}*\n` +
        `💰 Balance: *${balance.toFixed(2)} USD*\n` +
        `📊 Lot Size: *${config.lotSize}*\n` +
        `🟢 Active: *${botActive ? "Running ✅" : "Stopped ❌"}*\n` +
        `🕒 Market: *${marketOpen ? "OPEN ✅" : "CLOSED ❌"}*`;

      await safeSend(bot, msg.chat.id, statusMsg, { parse_mode: "Markdown" });
    } catch (err) {
      await safeSend(bot, msg.chat.id, `⚠️ Status error: ${err.message}`);
    }
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };