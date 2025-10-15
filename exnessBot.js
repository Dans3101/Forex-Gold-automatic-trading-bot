// -----------------------------------------------------------------------------
// exnessBot.js
// Live Gold Trading Bot — Using Finnhub API via ExnessAdapter.js
// -----------------------------------------------------------------------------

import { config } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

// Bot state
let botActive = false;
let intervalId = null;

// ✅ Initialize Finnhub Adapter
const adapter = new ExnessAdapter({
  apiKey: process.env.FINNHUB_API_KEY,
  useSimulation: true, // Set to false later for live trading
});

/**
 * ✅ Start Trading Bot
 */
async function startExnessBot(bot, chatId) {
  try {
    if (botActive) {
      await safeSend(bot, chatId, "⚠️ Bot is already running.");
      return;
    }

    botActive = true;
    console.log("🚀 Starting Exness Bot (Finnhub)...");
    await safeSend(bot, chatId, "🚀 Starting trading bot...");

    // Connect to Finnhub
    const connected = await adapter.connect();
    if (!connected) {
      await safeSend(bot, chatId, "❌ Failed to connect to Finnhub API. Check API key.");
      botActive = false;
      return;
    }

    await safeSend(bot, chatId, "✅ Connected to Finnhub API. Monitoring live gold price...");

    // Store starting balance
    const startBalance = await adapter.getBalance();

    // ⏱ Run every 10 seconds
    intervalId = setInterval(async () => {
      if (!botActive) return;

      try {
        // Check if market is open
        const marketOpen = await adapter.isMarketOpen();
        config.marketOpen = marketOpen;

        if (!marketOpen) {
          console.log("⏸ Market closed, waiting...");
          return;
        }

        // Get latest data
        const balance = await adapter.getBalance();
        const price = await adapter.getPrice(config.asset);
        const candles = await adapter.fetchHistoricCandles(config.asset);

        // Apply trading strategy
        const decision = await applyStrategy(candles);

        console.log(
          `📊 ${config.asset} | Decision: ${decision} | Balance: ${balance.toFixed(
            2
          )} | Price: ${price.toFixed(2)}`
        );

        // 🧠 Decision Handling (BUY / SELL)
        if (decision === "BUY" || decision === "SELL") {
          const order = await adapter.placeOrder({
            symbol: config.asset,
            side: decision,
            lotSize: config.lotSize,
          });

          if (order.success) {
            console.log(`✅ ${decision} signal triggered!`);
            await safeSend(
              bot,
              chatId,
              `🚨 *${decision} Signal Triggered!*\n\n` +
                `Asset: *${config.asset}*\n` +
                `Price: *${price.toFixed(2)}*\n` +
                `Lot: *${config.lotSize}*\n` +
                `Balance: *${balance.toFixed(2)} USD*`,
              { parse_mode: "Markdown" }
            );
          }
        }

        // 💬 Periodic update
        await safeSend(
          bot,
          chatId,
          `📈 *Live Update*\n\n` +
            `Asset: *${config.asset}*\n` +
            `Price: *${price.toFixed(2)}*\n` +
            `Decision: *${decision}*\n` +
            `Lot: *${config.lotSize}*\n` +
            `Stop Loss: *${config.stopLoss}%*\n` +
            `Take Profit: *${config.takeProfit} USD*\n` +
            `Balance: *${balance.toFixed(2)} USD*`,
          { parse_mode: "Markdown" }
        );

        // 🧮 Simulate running trades
        await adapter.simulateProfitLoss();
      } catch (err) {
        console.error("❌ Bot loop error:", err.message);
        await safeSend(bot, chatId, `⚠️ Bot Error: ${err.message}`);
      }
    }, 10000); // every 10 seconds
  } catch (err) {
    console.error("❌ startExnessBot() error:", err.message);
    await safeSend(bot, chatId, `⚠️ Start error: ${err.message}`);
  }
}

/**
 * ✅ Stop Trading Bot
 */
async function stopExnessBot(bot, chatId) {
  try {
    if (!botActive) {
      await safeSend(bot, chatId, "⚠️ Bot is not running.");
      return;
    }

    botActive = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    console.log("🛑 Bot stopped.");
    await safeSend(bot, chatId, "🛑 Bot stopped manually.");
  } catch (err) {
    console.error("❌ stopExnessBot() error:", err.message);
  }
}

/**
 * ✅ Safe Telegram send wrapper
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
 * ✅ Telegram Controls
 */
function setupTelegramHandlers(bot) {
  // Core controls
  bot.onText(/\/startbot/, (msg) => startExnessBot(bot, msg.chat.id));
  bot.onText(/\/stopbot/, (msg) => stopExnessBot(bot, msg.chat.id));

  // Status command
  bot.onText(/\/status/, async (msg) => {
    try {
      const connected = adapter.connected;
      const balance = await adapter.getBalance();
      const price = await adapter.getPrice(config.asset);
      const marketOpen = await adapter.isMarketOpen();

      const statusMsg =
        `🛰 *Bot Status*\n\n` +
        `🔗 Connection: *${connected ? "Connected ✅" : "Disconnected ❌"}*\n` +
        `🟢 Active: *${botActive ? "Running" : "Stopped"}*\n` +
        `💱 Asset: *${config.asset}*\n` +
        `💰 Balance: *${balance.toFixed(2)} USD*\n` +
        `💹 Price: *${price.toFixed(2)}*\n` +
        `⚙️ Strategy: *${config.strategy}*\n` +
        `📊 Lot Size: *${config.lotSize}*\n` +
        `🕒 Market: *${marketOpen ? "OPEN ✅" : "CLOSED ❌"}*`;

      await safeSend(bot, msg.chat.id, statusMsg, { parse_mode: "Markdown" });
    } catch (err) {
      await safeSend(bot, msg.chat.id, `⚠️ Error fetching status: ${err.message}`);
    }
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };