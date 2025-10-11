import { config, exness } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;

// ✅ Initialize adapter
const adapter = new ExnessAdapter({
  loginId: exness.loginId,
  password: exness.password,
  server: exness.server,
});

/**
 * ✅ Start Exness trading bot
 */
async function startExnessBot(bot, chatId) {
  if (botActive) {
    bot.sendMessage(chatId, "⚠️ Bot is already running.");
    return;
  }
  botActive = true;

  const connected = await adapter.connect();
  if (!connected) {
    bot.sendMessage(chatId, "❌ Failed to connect to Exness. Check your credentials or server.");
    botActive = false;
    return;
  }

  bot.sendMessage(chatId, "📈 Exness bot connected. Fetching live market data...");

  // Run bot every 15 seconds
  intervalId = setInterval(async () => {
    if (!botActive) return;

    try {
      const marketOpen = await adapter.isMarketOpen(config.asset);
      config.marketOpen = marketOpen;

      if (!marketOpen) {
        bot.sendMessage(chatId, "❌ Market is CLOSED. Bot waiting for open hours...");
        return;
      }

      const balance = await adapter.getBalance();
      const price = await adapter.getPrice(config.asset);

      const candles = await fetchHistoricCandles(config.asset);
      const decision = applyStrategy(candles);
      console.log(`📊 ${config.asset} | Decision: ${decision} | Balance: ${balance}`);

      bot.sendMessage(
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

      if (decision === "BUY" || decision === "SELL") {
        const order = await adapter.placeOrder({
          symbol: config.asset,
          side: decision,
          lotSize: config.lotSize,
        });

        if (order.success) {
          console.log(`✅ Order executed: ${decision} ${config.asset}`);
          bot.sendMessage(chatId, `✅ *Order executed:* ${decision} ${config.asset}`, {
            parse_mode: "Markdown",
          });
        } else {
          console.error("❌ Order failed:", order.error);
        }
      }

      // Risk management (simple placeholders)
      if (balance <= 0 || balance < config.stopLoss) {
        stopExnessBot(bot, chatId);
        bot.sendMessage(chatId, "🛑 Bot stopped due to Stop Loss condition.");
      }

      if (balance >= config.takeProfit) {
        stopExnessBot(bot, chatId);
        bot.sendMessage(chatId, "🎯 Bot stopped — Take Profit target reached.");
      }
    } catch (err) {
      console.error("❌ Bot loop error:", err.message);
      bot.sendMessage(chatId, `⚠️ Error: ${err.message}`);
    }
  }, 15000);
}

/**
 * ✅ Stop Exness trading bot
 */
function stopExnessBot(bot, chatId) {
  if (!botActive) {
    bot.sendMessage(chatId, "⚠️ Bot is not currently running.");
    return;
  }

  botActive = false;
  if (intervalId) clearInterval(intervalId);
  intervalId = null;

  bot.sendMessage(chatId, "🛑 Exness bot stopped.");
  console.log("🛑 Exness bot stopped.");
}

/**
 * ✅ Fetch candle data (simulated for now)
 */
async function fetchHistoricCandles(symbol) {
  const price = await adapter.getPrice(symbol);
  const candles = Array.from({ length: 50 }, () => ({
    open: price - Math.random() * 2,
    close: price + Math.random() * 2,
    high: price + Math.random() * 4,
    low: price - Math.random() * 4,
  }));
  return candles;
}

/**
 * ✅ Telegram controls & commands
 */
function setupTelegramHandlers(bot) {
  // Start/Stop commands
  bot.onText(/\/startbot/, (msg) => startExnessBot(bot, msg.chat.id));
  bot.onText(/\/stopbot/, (msg) => stopExnessBot(bot, msg.chat.id));

  // 📊 STATUS COMMAND
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

      bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: "Markdown" });
    } catch (err) {
      bot.sendMessage(msg.chat.id, `⚠️ Error fetching status: ${err.message}`);
    }
  });

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
    bot.sendMessage(msg.chat.id, "📐 Choose lot size:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "0.01", callback_data: "lot:0.01" }, { text: "0.1", callback_data: "lot:0.1" }],
          [{ text: "1", callback_data: "lot:1" }, { text: "5", callback_data: "lot:5" }],
          [{ text: "10", callback_data: "lot:10" }],
        ],
      },
    });
  });

  // Stop Loss selector
  bot.onText(/\/setsl/, (msg) => {
    bot.sendMessage(msg.chat.id, "🛑 Choose Stop Loss (%):", {
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
    bot.sendMessage(msg.chat.id, "🎯 Choose Take Profit (USD):", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "50 USD", callback_data: "tp:50" }, { text: "100 USD", callback_data: "tp:100" }],
          [{ text: "200 USD", callback_data: "tp:200" }, { text: "500 USD", callback_data: "tp:500" }],
        ],
      },
    });
  });

  // Strategy selector
  bot.onText(/\/setstrategy/, (msg) => {
    bot.sendMessage(msg.chat.id, "🧠 Choose a trading strategy:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Moving Average", callback_data: "strategy:movingAverage" }],
          [{ text: "Bollinger Bands", callback_data: "strategy:bollingerBands" }],
          [{ text: "MACD", callback_data: "strategy:macdStrategy" }],
          [{ text: "Combined Decision", callback_data: "strategy:combinedDecision" }],
        ],
      },
    });
  });

  // Handle inline selections
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