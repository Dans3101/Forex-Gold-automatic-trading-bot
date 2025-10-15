// -----------------------------------------------------------------------------
// exnessBot.js
// Live Gold Trading Bot — Using Finnhub API via ExnessAdapter.js
// -----------------------------------------------------------------------------

import { config } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;
let lastDecision = "HOLD";

// ✅ Initialize Finnhub Adapter
const adapter = new ExnessAdapter({
  apiKey: process.env.FINNHUB_API_KEY,
  useSimulation: false, // true for test, false for real
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

    await safeSend(bot, chatId, "✅ Connected to Finnhub API. Monitoring live gold prices...");

    const startBalance = await adapter.getBalance();

    // ⏱ Run analysis every 30 seconds
    intervalId = setInterval(async () => {
      if (!botActive) return;

      try {
        const marketOpen = await adapter.isMarketOpen();
        if (!marketOpen) {
          console.log("⏸ Market closed — waiting...");
          return;
        }

        const balance = await adapter.getBalance();
        const price = await adapter.getPrice(config.asset);
        const candles = await adapter.fetchHistoricCandles(config.asset);

        // Apply strategy logic
        const decision = await applyStrategy(candles);

        console.log(
          `📊 ${config.asset} | Decision: ${decision} | Price: ${price.toFixed(2)} | Balance: ${balance.toFixed(2)}`
        );

        // 🧠 Only act if decision changes
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
              `🚨 *${decision} Signal Triggered!*\n\n` +
                `Asset: *${config.asset}*\n` +
                `Price: *${price.toFixed(2)}*\n` +
                `Lot: *${config.lotSize}*\n` +
                `Balance: *${balance.toFixed(2)} USD*`,
              { parse_mode: "Markdown" }
            );
          }
        }

        // 🧾 Regular short update (every loop)
        await safeSend(
          bot,
          chatId,
          `📈 *Live Update*\n\n` +
            `Asset: *${config.asset}*\n` +
            `Price: *${price.toFixed(2)}*\n` +
            `Decision: *${decision}*\n` +
            `Lot: *${config.lotSize}*\n` +
            `Balance: *${balance.toFixed(2)} USD*`,
          { parse_mode: "Markdown" }
        );

        // Simulate active trades
        await adapter.simulateProfitLoss();

      } catch (err) {
        console.error("❌ Bot loop error:", err.message);
        await safeSend(bot, chatId, `⚠️ Bot Error: ${err.message}`);
      }
    }, 30000); // every 30 seconds

  } catch (err) {
    console.error("❌ startExnessBot() error:", err.message);
    await safeSend(bot, chatId, `⚠️ Start error: ${err.message}`);
  }
}

/**
 * ✅ Stop Bot
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
 * ✅ Telegram Controls
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