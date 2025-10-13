// exnessBot.js
// -----------------------------------------------------------------------------
// Live Price Trading Bot — using Twelve Data API via exnessAdapter.js
// -----------------------------------------------------------------------------

import { config } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

// Bot state
let botActive = false;
let intervalId = null;

// ✅ Initialize adapter (with your Twelve Data API key)
const adapter = new ExnessAdapter({
  apiKey: process.env.TWELVE_DATA_API_KEY,
  useSimulation: true, // trades are simulated for safety
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
    console.log("🚀 Starting Exness Bot...");

    // Connect to Twelve Data
    const connected = await adapter.connect();
    if (!connected) {
      await safeSend(bot, chatId, "❌ Failed to connect to Twelve Data API. Check API key.");
      botActive = false;
      return;
    }

    await safeSend(bot, chatId, "📈 Connected to Twelve Data API. Fetching live gold price...");

    // Store starting balance
    const startBalance = await adapter.getBalance();

    // ⏱ Fetch updates every 15 seconds
    intervalId = setInterval(async () => {
      if (!botActive) return;

      try {
        // Check if market is open
        const marketOpen = await adapter.isMarketOpen(config.asset);
        config.marketOpen = marketOpen;

        if (!marketOpen) {
          await safeSend(bot, chatId, "❌ Market is CLOSED. Waiting for open hours...");
          return;
        }

        // Get latest market data
        const balance = await adapter.getBalance();
        const price = await adapter.getPrice(config.asset);
        const candles = await adapter.fetchHistoricCandles(config.asset);

        // ✅ FIXED: Await strategy result
        const decision = await applyStrategy(candles);

        console.log(
          `📊 ${config.asset} | Decision: ${decision} | Balance: ${balance.toFixed(
            2
          )} | Price: ${price.toFixed(2)}`
        );

        // Send periodic update
        await safeSend(
          bot,
          chatId,
          `📊 *Live Update*\n\n` +
            `Asset: *${config.asset}*\n` +
            `Price: *${price.toFixed(2)}*\n` +
            `Decision: *${decision}*\n` +
            `Lot: *${config.lotSize}*\n` +
            `Trade Amount: *${config.tradeAmount}%*\n` +
            `SL: *${config.stopLoss}%*\n` +
            `TP: *${config.takeProfit} USD*\n` +
            `Balance: *${balance.toFixed(2)} USD*`,
          { parse_mode: "Markdown" }
        );

        // 🧠 Decision Handling
        if (decision === "BUY" || decision === "SELL") {
          const order = await adapter.placeOrder({
            symbol: config.asset,
            side: decision,
            lotSize: config.lotSize,
          });

          if (order.success) {
            console.log(`✅ Trade executed: ${decision} ${config.asset}`);
            await safeSend(
              bot,
              chatId,
              `✅ *Trade executed:* ${decision} ${config.asset}`,
              { parse_mode: "Markdown" }
            );
          } else {
            console.error("❌ Order failed:", order.error);
          }
        }

        // 🛑 Risk management (optional: remove auto-stop)
        if (balance <= 0 || balance < startBalance * (1 - config.stopLoss / 100)) {
          await safeSend(bot, chatId, "🛑 Stop Loss reached! Bot will pause for safety.");
          // comment the next line if you don’t want auto-stop
          await stopExnessBot(bot, chatId);
        }

        if (config.takeProfit > 0 && balance >= startBalance + config.takeProfit) {
          await safeSend(bot, chatId, "🎯 Take Profit reached! Bot will continue monitoring.");
          // ⚠️ Removed stop here for continuous operation
        }
      } catch (err) {
        console.error("❌ Bot loop error:", err.message);
        await safeSend(bot, chatId, `⚠️ Error: ${err.message}`);
      }
    }, 15000);
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
      await safeSend(bot, chatId, "⚠️ Bot is not currently running.");
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
 * ✅ Safe Telegram message wrapper
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
  // Start / Stop
  bot.onText(/\/startbot/, (msg) => startExnessBot(bot, msg.chat.id));
  bot.onText(/\/stopbot/, (msg) => stopExnessBot(bot, msg.chat.id));

  // Status check
  bot.onText(/\/status/, async (msg) => {
    try {
      const connected = adapter.connected;
      const balance = await adapter.getBalance();
      const price = await adapter.getPrice(config.asset);
      const marketOpen = await adapter.isMarketOpen(config.asset);

      const statusMsg =
        `🛰 *Bot Status*\n\n` +
        `🔗 Connection: *${connected ? "Connected ✅" : "Disconnected ❌"}*\n` +
        `🟢 Active: *${botActive ? "Running" : "Stopped"}*\n` +
        `💱 Asset: *${config.asset}*\n` +
        `💰 Balance: *${balance.toFixed(2)} USD*\n` +
        `💹 Price: *${price.toFixed(2)}*\n` +
        `⚙️ Strategy: *${config.strategy}*\n` +
        `📊 Lot Size: *${config.lotSize}*\n` +
        `🛑 Stop Loss: *${config.stopLoss}%*\n` +
        `🎯 Take Profit: *${config.takeProfit} USD*\n` +
        `🕒 Market: *${marketOpen ? "OPEN ✅" : "CLOSED ❌"}*`;

      await safeSend(bot, msg.chat.id, statusMsg, { parse_mode: "Markdown" });
    } catch (err) {
      await safeSend(bot, msg.chat.id, `⚠️ Error fetching status: ${err.message}`);
    }
  });

  // Configuration menus
  const menu = {
    asset: [
      [{ text: "XAUUSD (Gold)", callback_data: "asset:XAUUSD" }],
      [{ text: "EURUSD", callback_data: "asset:EURUSD" }],
      [{ text: "GBPUSD", callback_data: "asset:GBPUSD" }],
      [{ text: "BTCUSD", callback_data: "asset:BTCUSD" }],
    ],
    lot: [
      [{ text: "0.01", callback_data: "lot:0.01" }, { text: "0.1", callback_data: "lot:0.1" }],
      [{ text: "1", callback_data: "lot:1" }, { text: "5", callback_data: "lot:5" }],
      [{ text: "10", callback_data: "lot:10" }],
    ],
    sl: [
      [{ text: "5%", callback_data: "sl:5" }, { text: "10%", callback_data: "sl:10" }],
      [{ text: "20%", callback_data: "sl:20" }, { text: "30%", callback_data: "sl:30" }],
    ],
    tp: [
      [{ text: "50 USD", callback_data: "tp:50" }, { text: "100 USD", callback_data: "tp:100" }],
      [{ text: "200 USD", callback_data: "tp:200" }, { text: "500 USD", callback_data: "tp:500" }],
    ],
    strategy: [
      [{ text: "Moving Average", callback_data: "strategy:movingAverage" }],
      [{ text: "Bollinger Bands", callback_data: "strategy:bollingerBands" }],
      [{ text: "MACD", callback_data: "strategy:macdStrategy" }],
      [{ text: "Combined Decision", callback_data: "strategy:combinedDecision" }],
    ],
  };

  // Inline menus
  bot.onText(/\/setasset/, (msg) =>
    safeSend(bot, msg.chat.id, "💱 Choose a trading asset:", {
      reply_markup: { inline_keyboard: menu.asset },
    })
  );
  bot.onText(/\/setlot/, (msg) =>
    safeSend(bot, msg.chat.id, "📐 Choose lot size:", {
      reply_markup: { inline_keyboard: menu.lot },
    })
  );
  bot.onText(/\/setsl/, (msg) =>
    safeSend(bot, msg.chat.id, "🛑 Choose Stop Loss (%):", {
      reply_markup: { inline_keyboard: menu.sl },
    })
  );
  bot.onText(/\/settp/, (msg) =>
    safeSend(bot, msg.chat.id, "🎯 Choose Take Profit (USD):", {
      reply_markup: { inline_keyboard: menu.tp },
    })
  );
  bot.onText(/\/setstrategy/, (msg) =>
    safeSend(bot, msg.chat.id, "🧠 Choose a trading strategy:", {
      reply_markup: { inline_keyboard: menu.strategy },
    })
  );

  // Handle inline selections
  bot.on("callback_query", (query) => {
    const [key, value] = query.data.split(":");
    if (!key || !value) return;

    switch (key) {
      case "asset":
        config.asset = value;
        break;
      case "lot":
        config.lotSize = Number(value);
        break;
      case "sl":
        config.stopLoss = Number(value);
        break;
      case "tp":
        config.takeProfit = Number(value);
        break;
      case "strategy":
        config.strategy = value;
        break;
      default:
        break;
    }

    bot.answerCallbackQuery(query.id, {
      text: `✅ ${key.toUpperCase()} updated → ${value}`,
      show_alert: false,
    });
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };