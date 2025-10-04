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
      const { tradeAmount, strategy, stopLoss, takeProfit, asset } = config;

      const decision = applyStrategy(strategy, asset);

      console.log(`📌 Trade Decision: ${decision} on ${asset} with ${tradeAmount}% balance`);

      await bot.sendMessage(
        chatId,
        `📊 Strategy: *${strategy}*\nAsset: *${asset}*\nDecision: *${decision}*\nTrade Amount: *${tradeAmount}%*`,
        { parse_mode: "Markdown" }
      );

      // Risk conditions
      if (Math.random() * 100 < stopLoss) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🛑 Bot stopped due to Stop Loss condition.");
      }

      if (Math.random() * 100 < takeProfit) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🎉 Bot stopped due to Take Profit condition.");
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
  // Strategy selector
  bot.onText(/\/setstrategy/, (msg) => {
    bot.sendMessage(msg.chat.id, "📊 Choose a strategy:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📈 Moving Average", callback_data: "strategy:ma" }],
          [{ text: "📉 RSI", callback_data: "strategy:rsi" }],
          [{ text: "💹 MACD", callback_data: "strategy:macd" }],
          [{ text: "📊 Bollinger Bands", callback_data: "strategy:bb" }]
        ]
      }
    });
  });

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

  // Trade amount selector
  bot.onText(/\/setamount/, (msg) => {
    bot.sendMessage(msg.chat.id, "💰 Choose trade amount (% of balance):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1%", callback_data: "amount:1" }, { text: "2%", callback_data: "amount:2" }],
          [{ text: "5%", callback_data: "amount:5" }, { text: "10%", callback_data: "amount:10" }]
        ]
      }
    });
  });

  // Stop Loss selector
  bot.onText(/\/setsl/, (msg) => {
    bot.sendMessage(msg.chat.id, "🛑 Set Stop Loss (%):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "5%", callback_data: "sl:5" }, { text: "10%", callback_data: "sl:10" }],
          [{ text: "20%", callback_data: "sl:20" }, { text: "30%", callback_data: "sl:30" }]
        ]
      }
    });
  });

  // Take Profit selector
  bot.onText(/\/settp/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎯 Set Take Profit (%):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "10%", callback_data: "tp:10" }, { text: "20%", callback_data: "tp:20" }],
          [{ text: "30%", callback_data: "tp:30" }, { text: "50%", callback_data: "tp:50" }]
        ]
      }
    });
  });

  // Handle callback button presses
  bot.on("callback_query", (query) => {
    const [key, value] = query.data.split(":");

    if (key === "strategy") {
      config.strategy = value;
      bot.answerCallbackQuery(query.id, { text: `✅ Strategy set to ${value.toUpperCase()}` });
    }
    if (key === "asset") {
      config.asset = value;
      bot.answerCallbackQuery(query.id, { text: `✅ Asset set to ${value}` });
    }
    if (key === "amount") {
      config.tradeAmount = Number(value);
      bot.answerCallbackQuery(query.id, { text: `✅ Trade amount set to ${value}%` });
    }
    if (key === "sl") {
      config.stopLoss = Number(value);
      bot.answerCallbackQuery(query.id, { text: `✅ Stop Loss set to ${value}%` });
    }
    if (key === "tp") {
      config.takeProfit = Number(value);
      bot.answerCallbackQuery(query.id, { text: `✅ Take Profit set to ${value}%` });
    }
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };