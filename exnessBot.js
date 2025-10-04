// exnessBot.js
import { config } from "./config.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;

/**
 * Simulated check if market is open
 * (In real implementation, you’d check broker API or time/day)
 */
function isMarketOpen() {
  const day = new Date().getUTCDay();   // 0=Sun ... 6=Sat
  const hour = new Date().getUTCHours();
  // Example: Forex closed on weekends (Fri 21:00 → Sun 21:00 UTC)
  if (day === 6 || day === 0) return false;
  return true;
}

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
      config.marketOpen = isMarketOpen();

      if (!config.marketOpen) {
        await bot.sendMessage(chatId, "❌ Market is currently CLOSED. No trades placed.");
        return;
      }

      const { tradeAmount, lotSize, strategy, stopLoss, takeProfit, asset } = config;

      // Bot picks strategy automatically
      const decision = applyStrategy(strategy, asset);

      console.log(
        `📌 Trade Decision: ${decision} | Asset: ${asset} | Lot: ${lotSize} | Amount: ${tradeAmount}%`
      );

      await bot.sendMessage(
        chatId,
        `📊 *Trade Signal:*\n\n` +
          `Asset: *${asset}*\n` +
          `Decision: *${decision}*\n` +
          `Lot Size: *${lotSize}*\n` +
          `Trade Amount: *${tradeAmount}% of balance*\n` +
          `Stop Loss: *${stopLoss}%*\n` +
          `Take Profit Target: *${takeProfit} USD*`,
        { parse_mode: "Markdown" }
      );

      // Risk management (simulation for now)
      if (Math.random() * 100 < stopLoss) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🛑 Bot stopped due to Stop Loss condition.");
      }

      // Fixed profit condition
      if (Math.random() * 500 < takeProfit) {
        stopExnessBot();
        await bot.sendMessage(
          chatId,
          `🎉 Bot stopped after reaching profit target of ${takeProfit} USD.`
        );
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
function setupTelegramHandlers(bot) {
  // Asset selector
  bot.onText(/\/setasset/, (msg) => {
    bot.sendMessage(msg.chat.id, "💱 Choose a trading asset:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "XAUUSD (Gold)", callback_data: "asset:XAUUSD" }],
          [{ text: "EURUSD", callback_data: "asset:EURUSD" }],
          [{ text: "GBPUSD", callback_data: "asset:GBPUSD" }],
          [{ text: "BTCUSD", callback_data: "asset:BTCUSD" }],
        ],
      },
    });
  });

  // Lot size selector
  bot.onText(/\/setlot/, (msg) => {
    bot.sendMessage(msg.chat.id, "📐 Choose lot size (0.01 – 10):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "0.01", callback_data: "lot:0.01" }, { text: "0.1", callback_data: "lot:0.1" }],
          [{ text: "1", callback_data: "lot:1" }, { text: "5", callback_data: "lot:5" }],
          [{ text: "10", callback_data: "lot:10" }],
        ],
      },
    });
  });

  // Trade amount selector
  bot.onText(/\/setamount/, (msg) => {
    bot.sendMessage(msg.chat.id, "💰 Choose trade amount (% of balance):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1%", callback_data: "amount:1" }, { text: "2%", callback_data: "amount:2" }],
          [{ text: "5%", callback_data: "amount:5" }, { text: "10%", callback_data: "amount:10" }],
        ],
      },
    });
  });

  // Stop Loss selector
  bot.onText(/\/setsl/, (msg) => {
    bot.sendMessage(msg.chat.id, "🛑 Set Stop Loss (%):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "5%", callback_data: "sl:5" }, { text: "10%", callback_data: "sl:10" }],
          [{ text: "20%", callback_data: "sl:20" }, { text: "30%", callback_data: "sl:30" }],
        ],
      },
    });
  });

  // Take Profit selector
  bot.onText(/\/settp/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎯 Set Take Profit (USD):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "50 USD", callback_data: "tp:50" }, { text: "100 USD", callback_data: "tp:100" }],
          [{ text: "200 USD", callback_data: "tp:200" }, { text: "500 USD", callback_data: "tp:500" }],
        ],
      },
    });
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
      bot.answerCallbackQuery(query.id, { text: `✅ Take Profit set to ${value} USD` });
    }
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };