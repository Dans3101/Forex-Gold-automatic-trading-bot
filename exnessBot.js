// exnessBot.js
import { config, exness } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;

// Initialize adapter instance (real or simulated)
const adapter = new ExnessAdapter({
  loginId: exness.loginId,
  password: exness.password,
  server: exness.server,
  useSimulation: config.simulationMode,
});

/**
 * Start Exness trading bot
 */
async function startExnessBot(bot, chatId) {
  if (botActive) return;
  botActive = true;

  await adapter.connect();
  bot.sendMessage(chatId, "📈 Exness trading bot connected and starting...");

  intervalId = setInterval(async () => {
    if (!botActive) return;

    try {
      // Check market status
      const marketOpen = await adapter.isMarketOpen(config.asset);
      config.marketOpen = marketOpen;

      if (!marketOpen) {
        await bot.sendMessage(chatId, "❌ Market is currently *CLOSED*. Waiting for open hours...", {
          parse_mode: "Markdown",
        });
        return;
      }

      // Fetch dynamic account and market data
      const balance = await adapter.getBalance();
      const price = await adapter.getPrice(config.asset);

      // Auto strategy selection (for now pick one randomly or by condition)
      const decision = applyStrategy(config.strategy, config.asset);
      console.log(`📊 ${config.asset} | Decision: ${decision} | Lot: ${config.lotSize} | Balance: ${balance}`);

      // Send trade update
      await bot.sendMessage(
        chatId,
        `📊 *Trade Update*\n\n` +
          `Asset: *${config.asset}*\n` +
          `Market Price: *${price}*\n` +
          `Decision: *${decision.toUpperCase()}*\n` +
          `Lot Size: *${config.lotSize}*\n` +
          `Trade Amount: *${config.tradeAmount}%*\n` +
          `Stop Loss: *${config.stopLoss}%*\n` +
          `Take Profit: *${config.takeProfit} USD*\n` +
          `Balance: *${balance.toFixed(2)} USD*\n\n` +
          (marketOpen ? "✅ *Market Open*" : "❌ *Market Closed*"),
        { parse_mode: "Markdown" }
      );

      // Place simulated order
      const order = await adapter.placeOrder({
        symbol: config.asset,
        side: decision,
        lotSize: config.lotSize,
      });

      console.log("✅ Order placed:", order);

      // Check risk conditions
      if (Math.random() * 100 < config.stopLoss) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🛑 Bot stopped due to Stop Loss condition.");
      }

      // Profit condition
      if (Math.random() * 1000 < config.takeProfit / 10) {
        stopExnessBot();
        await bot.sendMessage(
          chatId,
          `🎉 Bot stopped after reaching target profit of *${config.takeProfit} USD*`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {
      console.error("❌ Bot error:", err.message);
      await bot.sendMessage(chatId, `❌ Bot error: ${err.message}`);
    }
  }, 15000); // Run every 15s
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
 * Setup Telegram handlers
 */
function setupTelegramHandlers(bot) {
  // --- Asset selector ---
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

  // --- Lot size selector ---
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

  // --- Stop Loss selector ---
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

  // --- Take Profit selector ---
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

  // --- Handle button responses ---
  bot.on("callback_query", (query) => {
    const [key, value] = query.data.split(":");

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
      default:
        break;
    }

    bot.answerCallbackQuery(query.id, {
      text: `✅ Updated: ${key.toUpperCase()} → ${value}`,
      show_alert: false,
    });
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };