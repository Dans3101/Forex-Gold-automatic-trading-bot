// exnessBot.js
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
  try {
    if (botActive) {
      await safeSend(bot, chatId, "⚠️ Bot is already running.");
      return;
    }

    botActive = true;
    console.log("🚀 Starting Exness bot...");

    const connected = await adapter.connect();
    if (!connected) {
      await safeSend(bot, chatId, "❌ Failed to connect to Exness. Check credentials/server.");
      botActive = false;
      return;
    }

    await safeSend(bot, chatId, "📈 Exness bot connected. Fetching live market data...");

    // ⏱ Run bot every 15 seconds
    intervalId = setInterval(async () => {
      if (!botActive) return;

      try {
        const marketOpen = await adapter.isMarketOpen(config.asset);
        config.marketOpen = marketOpen;

        if (!marketOpen) {
          await safeSend(bot, chatId, "❌ Market is CLOSED. Waiting for open hours...");
          return;
        }

        const balance = await adapter.getBalance();
        const price = await adapter.getPrice(config.asset);
        const candles = await fetchHistoricCandles(config.asset);
        const decision = applyStrategy(candles);

        console.log(`📊 ${config.asset} | Decision: ${decision} | Balance: ${balance.toFixed(2)} | Price: ${price.toFixed(2)}`);

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

        if (decision === "BUY" || decision === "SELL") {
          const order = await adapter.placeOrder({
            symbol: config.asset,
            side: decision,
            lotSize: config.lotSize,
          });

          if (order.success) {
            console.log(`✅ Order executed: ${decision} ${config.asset}`);
            await safeSend(bot, chatId, `✅ *Order executed:* ${decision} ${config.asset}`, { parse_mode: "Markdown" });
          } else {
            console.error("❌ Order failed:", order.error);
          }
        }

        // 🛑 Risk management
        if (balance <= 0 || balance < config.stopLoss) {
          await stopExnessBot(bot, chatId);
          await safeSend(bot, chatId, "🛑 Bot stopped due to Stop Loss condition.");
        }

        if (balance >= config.takeProfit) {
          await stopExnessBot(bot, chatId);
          await safeSend(bot, chatId, "🎯 Bot stopped — Take Profit target reached.");
        }
      } catch (err) {
        console.error("❌ Bot loop error:", err.message);
        await safeSend(bot, chatId, `⚠️ Error: ${err.message}`);
      }
    }, 15000);
  } catch (err) {
    console.error("❌ startExnessBot() error:", err.message);
  }
}

/**
 * ✅ Stop Exness trading bot
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

    console.log("🛑 Exness bot stopped.");
    await safeSend(bot, chatId, "🛑 Exness bot stopped.");
  } catch (err) {
    console.error("❌ stopExnessBot() error:", err.message);
  }
}

/**
 * ✅ Fetch candle data (simulated for now)
 */
async function fetchHistoricCandles(symbol) {
  const price = await adapter.getPrice(symbol);
  return Array.from({ length: 50 }, () => ({
    open: price - Math.random() * 2,
    close: price + Math.random() * 2,
    high: price + Math.random() * 4,
    low: price - Math.random() * 4,
  }));
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
 * ✅ Telegram controls & commands
 */
function setupTelegramHandlers(bot) {
  // Start / Stop
  bot.onText(/\/startbot/, (msg) => startExnessBot(bot, msg.chat.id));
  bot.onText(/\/stopbot/, (msg) => stopExnessBot(bot, msg.chat.id));

  // Status
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

  // Adjustable settings
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

  bot.onText(/\/setasset/, (msg) => safeSend(bot, msg.chat.id, "💱 Choose a trading asset:", { reply_markup: { inline_keyboard: menu.asset } }));
  bot.onText(/\/setlot/, (msg) => safeSend(bot, msg.chat.id, "📐 Choose lot size:", { reply_markup: { inline_keyboard: menu.lot } }));
  bot.onText(/\/setsl/, (msg) => safeSend(bot, msg.chat.id, "🛑 Choose Stop Loss (%):", { reply_markup: { inline_keyboard: menu.sl } }));
  bot.onText(/\/settp/, (msg) => safeSend(bot, msg.chat.id, "🎯 Choose Take Profit (USD):", { reply_markup: { inline_keyboard: menu.tp } }));
  bot.onText(/\/setstrategy/, (msg) => safeSend(bot, msg.chat.id, "🧠 Choose a trading strategy:", { reply_markup: { inline_keyboard: menu.strategy } }));

  // Handle inline selections
  bot.on("callback_query", (query) => {
    const [key, value] = query.data.split(":");
    if (!key || !value) return;

    switch (key) {
      case "asset": config.asset = value; break;
      case "lot": config.lotSize = Number(value); break;
      case "sl": config.stopLoss = Number(value); break;
      case "tp": config.takeProfit = Number(value); break;
      case "strategy": config.strategy = value; break;
      default: break;
    }

    bot.answerCallbackQuery(query.id, { text: `✅ ${key.toUpperCase()} updated → ${value}`, show_alert: false });
  });
}

export { startExnessBot, stopExnessBot, setupTelegramHandlers };