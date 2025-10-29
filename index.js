// index.js
// -----------------------------------------------------------------------------
// ⚡ Exness Gold Trading Bot — Telegram + Finnhub Integration
// -----------------------------------------------------------------------------

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startExnessBot, stopExnessBot, setupTelegramHandlers } from "./exnessBot.js";
import { telegramToken, telegramChatId, config } from "./config.js";
import { startFinnhubBot } from "./finnhubAdapter.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const URL = process.env.RENDER_EXTERNAL_URL || `https://your-app.onrender.com`;

let bot;
let adapter;

// -----------------------------------------------------------------------------
// 🔹 Initialize Finnhub Adapter
// -----------------------------------------------------------------------------
async function initFinnhub() {
  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error("Missing FINNHUB_API_KEY in environment variables");
    }

    console.log("🔌 Connecting to Finnhub API...");
    adapter = await startFinnhubBot({ apiKey: process.env.FINNHUB_API_KEY });

    const balance = await adapter.getBalance();
    console.log(`✅ Finnhub connected successfully!`);
    console.log(`💰 Simulated Account Balance: ${balance.toFixed(2)} USD`);
  } catch (err) {
    console.error("❌ Failed to initialize FinnhubAdapter:", err.message);
  }
}

// -----------------------------------------------------------------------------
// 🔹 Initialize Telegram Bot
// -----------------------------------------------------------------------------
function initTelegram() {
  if (!telegramToken) {
    console.error("❌ Telegram bot token missing. Please check your .env file.");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    bot = new TelegramBot(telegramToken, { webHook: true });
    bot.setWebHook(`${URL}/webhook/${telegramToken}`);
    console.log(`🌍 Webhook set to: ${URL}/webhook/${telegramToken}`);
  } else {
    bot = new TelegramBot(telegramToken, { polling: true });
    console.log("📡 Telegram bot running in polling mode (development)");
  }

  // ✅ Register bot commands
  bot.setMyCommands([
    { command: "/start", description: "Show welcome message & menu" },
    { command: "/exstart", description: "Start Finnhub (Exness) trading bot" },
    { command: "/exstop", description: "Stop trading bot" },
    { command: "/config", description: "Show current configuration" },
    { command: "/balance", description: "Check account balance" },
    { command: "/open", description: "View open trades" },
  ]);

  // ✅ /start Command UI
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`📲 User ${chatId} started a bot session`);

    bot.sendMessage(chatId, "👋 Welcome to *Dans Code Exness Gold Bot*!", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "▶ Start Bot", callback_data: "exstart" },
            { text: "⏹ Stop Bot", callback_data: "exstop" },
          ],
          [{ text: "⚙ Show Config", callback_data: "config" }],
          [
            { text: "💰 Set Asset", callback_data: "setasset" },
            { text: "📊 Set Lot Size", callback_data: "setlot" },
          ],
          [
            { text: "🛑 Set StopLoss", callback_data: "setsl" },
            { text: "🎯 Set TakeProfit", callback_data: "settp" },
          ],
          [{ text: "💵 Show Balance", callback_data: "balance" }],
        ],
      },
    });
  });

  // ✅ Handle Button Actions
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const action = query.data;
    console.log(`📩 Button pressed by ${chatId}: ${action}`);

    try {
      switch (action) {
        case "exstart":
          if (!adapter) throw new Error("Finnhub adapter not ready.");
          await startExnessBot(bot, chatId, adapter);
          await bot.sendMessage(chatId, "✅ Trading bot started!");
          break;

        case "exstop":
          await stopExnessBot(bot, chatId);
          await bot.sendMessage(chatId, "🛑 Trading bot stopped.");
          break;

        case "config":
          await bot.sendMessage(
            chatId,
            `⚙️ *Current Configuration:*\n` +
              `Asset: *${config.asset}*\n` +
              `Lot Size: *${config.lotSize}*\n` +
              `Trade Amount: *${config.tradeAmount}%*\n` +
              `Stop Loss: *${config.stopLoss}%*\n` +
              `Take Profit: *${config.takeProfit} USD*\n` +
              `Simulation Mode: *${config.simulationMode ? "ON" : "OFF"}*`,
            { parse_mode: "Markdown" }
          );
          break;

        case "balance":
          if (!adapter) throw new Error("Adapter not connected.");
          const balance = await adapter.getBalance();
          await bot.sendMessage(chatId, `💵 *Balance:* ${balance.toFixed(2)} USD`, {
            parse_mode: "Markdown",
          });
          break;

        case "open":
          if (!adapter) throw new Error("Adapter not connected.");
          const trades = await adapter.getOpenTrades();
          if (!trades?.length) {
            await bot.sendMessage(chatId, "📭 No open trades currently.");
          } else {
            const tradeList = trades
              .map(
                (t) =>
                  `#${t.id}\nSymbol: ${t.symbol}\nSide: ${t.side}\nPrice: ${t.price}\nLot: ${t.lotSize}`
              )
              .join("\n\n");
            await bot.sendMessage(chatId, `📋 *Open Trades:*\n\n${tradeList}`, {
              parse_mode: "Markdown",
            });
          }
          break;

        default:
          await bot.sendMessage(chatId, "❌ Unknown action selected.");
      }
    } catch (err) {
      console.error(`⚠️ Error processing "${action}":`, err.message);
      await bot.sendMessage(chatId, `⚠️ Error: ${err.message}`);
    }

    bot.answerCallbackQuery(query.id);
  });

  // ✅ Setup Additional Telegram Handlers
  setupTelegramHandlers(bot, telegramChatId);

  return bot;
}

// -----------------------------------------------------------------------------
// 🔹 Webhook Endpoint for Render
// -----------------------------------------------------------------------------
app.post(`/webhook/${telegramToken}`, (req, res) => {
  if (bot) bot.processUpdate(req.body);
  res.sendStatus(200);
});

// -----------------------------------------------------------------------------
// 🚀 Initialize App
// -----------------------------------------------------------------------------
app.listen(PORT, async () => {
  console.log(`🚀 Server is live on port ${PORT}`);
  await initFinnhub();
  initTelegram();
});