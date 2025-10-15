// -----------------------------------------------------------------------------
// exnessBot.js
// Live Gold Trading Bot — Using Finnhub API (via ExnessAdapter.js)
// -----------------------------------------------------------------------------

import { config } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;
let lastDecision = "HOLD";
let lastPrice = null;
let errorCount = 0;

// ✅ Initialize Finnhub Adapter
const adapter = new ExnessAdapter({
  apiKey: process.env.FINNHUB_API_KEY,
  useSimulation: false, // Set true for test mode
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
 * ✅ Core loop to fetch data and make trade decisions
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
      throw new Error("Invalid data from Finnhub.");
    }

    // Apply strategy to get decision
    const decision = await applyStrategy(candles);

    console.log(
      `📊 ${config.asset} | ${decision} | Price: ${price.toFixed(2)} | Balance: ${balance.toFixed(2)}`
    );

    // Skip HOLD signals unless trend changes
    if (decision !== lastDecision && (decision === "BUY" || decision === "SELL")) {
      lastDecision = decision;

      const order = await adapter.placeOrder({
        symbol: config.asset,
        side: decision,
        lotSize: config.lotSize,
      });

      if (order.success) {
        await safeSend(
          bot,
          chatId,
          `🚨 *${decision} SIGNAL TRIGGERED!*\n\n` +
            `💱 Asset: *${config.asset}*\n` +
            `💰 Balance: *${balance.toFixed(2)} USD*\n` +
            `💹 Price: *${price.toFixed(2)}*\n` +
            `📦 Lot: *${config.lotSize}*\n` +
            `🧠 Strategy: *${config.strategy}*`,
          { parse_mode: "Markdown" }
        );
      }
    }

    // Send small update if price changed a lot
    if (!lastPrice || Math.abs(price - lastPrice) / lastPrice > 0.002) {
      await safeSend(
        bot,
        chatId,
        `📈 *Market Update*\n\n` +
          `💱 Asset: *${config.asset}*\n` +
          `💹 Price: *${price.toFixed(2)}*\n` +
          `🧭 Decision: *${decision}*\n` +
          `💰 Balance: *${balance.toFixed(2)} USD*`,
        { parse_mode: "Markdown" }
      );
      lastPrice = price;
    }

    // Simulate profit/loss
    await adapter.simulateProfitLoss();
    errorCount = 0; // reset after success
  } catch (err) {
    console.error("❌ Bot loop error:", err.message);
    errorCount++;
    if (errorCount > 3) {
      console.log("⚠️ Too many errors — attempting reconnection...");
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
  console.log("🚀 Starting Exness Bot (Finnhub)...");
  await safeSend(bot, chatId, "🚀 Starting trading bot...");

  const connected = await adapter.connect();
  if (!connected) {
    await safeSend(bot, chatId, "❌ Failed to connect to Finnhub API. Check your API key.");
    botActive = false;
    return;
  }

  await safeSend(bot, chatId, "✅ Connected to Finnhub API. Monitoring live gold prices...");
  console.log("✅ Connected to Finnhub API.");

  // Run every 30 seconds
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
 * ✅ Telegram Commands
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
        `⚙️ Strategy: *${config.strategy}*\n` +
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