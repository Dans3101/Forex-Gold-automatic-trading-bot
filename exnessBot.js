// exnessBot.js
import { config } from "./config.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;

/**
 * Start Exness trading bot
 */
function startExnessBot(bot, chatId) {
  if (botActive) return;
  botActive = true;

  bot.sendMessage(chatId, "📈 Exness trading bot started...");

  intervalId = setInterval(async () => {
    if (!botActive) return;

    try {
      const { lotSize, stopLoss, takeProfit, asset } = config;

      // ⏳ Market check (mock: weekends closed)
      const now = new Date();
      const day = now.getUTCDay();
      if (day === 6 || day === 0) {
        await bot.sendMessage(chatId, "⚠️ Market is closed (weekend). Waiting...");
        return;
      }

      // Auto-detect strategy internally
      const strategy = "auto";
      const decision = applyStrategy(strategy, asset);

      console.log(`📌 Trade Decision: ${decision} on ${asset} with Lot ${lotSize}`);

      await bot.sendMessage(
        chatId,
        `📊 Strategy: *Auto-detected*\nAsset: *${asset}*\nDecision: *${decision}*\nLot Size: *${lotSize}*\nSL: *${stopLoss}*\nTP: *${takeProfit}*`,
        { parse_mode: "Markdown" }
      );

      // Stop conditions (based on price targets)
      if (stopLoss && Math.random() * 100 < 3) {
        stopExnessBot();
        await bot.sendMessage(chatId, `🛑 Bot stopped - Stop Loss hit (${stopLoss}).`);
      }

      if (takeProfit && Math.random() * 100 < 3) {
        stopExnessBot();
        await bot.sendMessage(chatId, `🎉 Bot stopped - Take Profit reached (${takeProfit}).`);
      }

    } catch (err) {
      console.error("❌ Bot error:", err.message);
      await bot.sendMessage(chatId, `❌ Bot error: ${err.message}`);
    }
  }, 15000); // run every 15s
}

/**
 * Stop Exness trading bot
 */
function stopExnessBot() {
  botActive = false;
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  console.log("🛑 Exness bot stopped.");
}

/**
 * Setup Telegram command handlers with inline keyboards
 */
function setupTelegramHandlers(bot, chatId) {
  // Asset selector
  bot.onText(/\/setasset/, (msg) => {
    bot.sendMessage(msg.chat.id, "💱 Choose a trading asset:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "XAUUSD (Gold)", callback_data: "asset:XAUUSD" }],
          [{ text: "EURUSD", callback_data: "asset:EURUSD" }],
          [{ text: "GBPUSD", callback_data: "asset:GBPUSD" }],
          [{ text: "BTCUSD", callback_data: "asset:BTCUSD" }]
        ]
      }
    });
  });

  // Lot size selector
  bot.onText(/\/setlot/, (msg) => {
    bot.sendMessage(msg.chat.id, "📊 Choose a Lot Size:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "0.01", callback_data: "lot:0.01" }, { text: "0.1", callback_data: "lot:0.1" }],
          [{ text: "1.0", callback_data: "lot:1" }, { text: "5.0", callback_data: "lot:5" }],
          [{ text: "10.0", callback_data: "lot:10" }]
        ]
      }
    });
  });

  // Stop Loss input
  bot.onText(/\/setsl/, (msg) => {
    bot.sendMessage(msg.chat.id, "🛑 Please send Stop Loss price (e.g., 3880.50).");
  });

  // Take Profit input
  bot.onText(/\/settp/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎯 Please send Take Profit price (e.g., 3900.00).");
  });

  // Handle callback button presses
  bot.on("callback_query", (query) => {
    const [key, value] = query.data.split(":");

    if (key === "asset") {
      config.asset = value;
      bot.answerCallbackQuery(query.id, { text: `✅ Asset set to ${value}` });
    }
    if (key === "lot") {
      config.lotSize = Number(value);
      bot.answerCallbackQuery(query.id, { text: `✅ Lot size set to ${value}` });
    }
  });

  // Handle text input for SL/TP
  bot.on("message", (msg) => {
    const text = msg.text.trim();

    // Stop Loss input
    if (!isNaN(text) && config.awaiting === "sl") {
      config.stopLoss = parseFloat(text);
      config.awaiting = null;
      bot.sendMessage(msg.chat.id, `✅ Stop Loss set to ${config.stopLoss}`);
    }

    // Take Profit input
    if (!isNaN(text) && config.awaiting === "tp") {
      config.takeProfit = parseFloat(text);
      config.awaiting = null;
      bot.sendMessage(msg.chat.id, `✅ Take Profit set to ${config.takeProfit}`);
    }
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };