// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startExnessBot, stopExnessBot, setupTelegramHandlers } from "./exnessBot.js";
import { telegramToken, telegramChatId, config } from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const URL = process.env.RENDER_EXTERNAL_URL || `https://your-app.onrender.com`; // replace with your Render URL

// ✅ Use polling locally, webhook on Render
let bot;
if (process.env.NODE_ENV === "production") {
  bot = new TelegramBot(telegramToken, { webHook: true });
  bot.setWebHook(`${URL}/webhook/${telegramToken}`);
  console.log(`🌍 Webhook set to ${URL}/webhook/${telegramToken}`);
} else {
  bot = new TelegramBot(telegramToken, { polling: true });
  console.log("📡 Running bot in polling mode (local)");
}

// ✅ Command menu
bot.setMyCommands([
  { command: "/start", description: "Show welcome message & buttons" },
  { command: "/exstart", description: "Start Exness trading bot" },
  { command: "/exstop", description: "Stop Exness trading bot" },
  { command: "/config", description: "Show current bot config" },
  { command: "/setstrategy", description: "Choose trading strategy" },
  { command: "/setasset", description: "Select trading asset" },
  { command: "/setamount", description: "Set trade amount (%)" },
  { command: "/setsl", description: "Set Stop Loss (%)" },
  { command: "/settp", description: "Set Take Profit (%)" }
]);

// ✅ Start message with inline buttons
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `👋 Welcome to your Forex Trading Bot!\n\nUse the buttons below to control the bot:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "▶ Start Bot", callback_data: "exstart" },
            { text: "⏹ Stop Bot", callback_data: "exstop" }
          ],
          [
            { text: "⚙ Show Config", callback_data: "config" }
          ],
          [
            { text: "📊 Set Strategy", callback_data: "setstrategy" },
            { text: "💰 Set Asset", callback_data: "setasset" }
          ],
          [
            { text: "💵 Set Amount", callback_data: "setamount" },
            { text: "🛑 Set StopLoss", callback_data: "setsl" },
            { text: "🎯 Set TakeProfit", callback_data: "settp" }
          ]
        ]
      }
    }
  );
});

// ✅ Handle inline button clicks
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  switch (action) {
    case "exstart":
      startExnessBot(bot, chatId);
      bot.sendMessage(chatId, "✅ Exness bot started!");
      break;

    case "exstop":
      stopExnessBot();
      bot.sendMessage(chatId, "🛑 Exness bot stopped.");
      break;

    case "config":
      const { tradeAmount, strategy, stopLoss, takeProfit, asset } = config;
      bot.sendMessage(
        chatId,
        `⚙️ *Current Bot Config:*\n\n` +
        `Strategy: *${strategy}*\nAsset: *${asset}*\nTrade Amount: *${tradeAmount}%*\nStop Loss: *${stopLoss}%*\nTake Profit: *${takeProfit}%*`,
        { parse_mode: "Markdown" }
      );
      break;

    case "setstrategy":
      bot.sendMessage(chatId, "📊 Please send the strategy name you want to use.");
      break;

    case "setasset":
      bot.sendMessage(chatId, "💰 Please send the asset (e.g., XAUUSD).");
      break;

    case "setamount":
      bot.sendMessage(chatId, "💵 Please send the trade amount (%) you want to use.");
      break;

    case "setsl":
      bot.sendMessage(chatId, "🛑 Please send the Stop Loss (%) value.");
      break;

    case "settp":
      bot.sendMessage(chatId, "🎯 Please send the Take Profit (%) value.");
      break;

    default:
      bot.sendMessage(chatId, "❌ Unknown action.");
  }

  bot.answerCallbackQuery(query.id); // remove loading spinner
});

// ✅ Inline keyboards for strategies & assets from exnessBot.js
setupTelegramHandlers(bot, telegramChatId);

// ✅ Webhook endpoint for Render
app.post(`/webhook/${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});