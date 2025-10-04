// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startExnessBot, stopExnessBot, setupTelegramHandlers } from "./exnessBot.js";
import { telegramToken, telegramChatId, config } from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ One Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// ✅ Register command menu so they appear in Telegram
bot.setMyCommands([
  { command: "/start", description: "Show welcome message" },
  { command: "/exstart", description: "Start Exness trading bot" },
  { command: "/exstop", description: "Stop Exness trading bot" },
  { command: "/config", description: "Show current bot config" },
  { command: "/setstrategy", description: "Choose trading strategy" },
  { command: "/setasset", description: "Select trading asset" },
  { command: "/setamount", description: "Set trade amount (%)" },
  { command: "/setsl", description: "Set Stop Loss (%)" },
  { command: "/settp", description: "Set Take Profit (%)" }
]);

// ✅ Handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome to your Forex Trading Bot!\n\nUse the menu commands below to control the bot.`
  );
});

bot.onText(/\/exstart/, (msg) => {
  startExnessBot(bot, msg.chat.id);
});

bot.onText(/\/exstop/, (msg) => {
  stopExnessBot();
  bot.sendMessage(msg.chat.id, "🛑 Exness bot stopped.");
});

bot.onText(/\/config/, (msg) => {
  const { tradeAmount, strategy, stopLoss, takeProfit, asset } = config;
  bot.sendMessage(
    msg.chat.id,
    `⚙️ *Current Bot Config:*\n\n` +
    `Strategy: *${strategy}*\nAsset: *${asset}*\nTrade Amount: *${tradeAmount}%*\nStop Loss: *${stopLoss}%*\nTake Profit: *${takeProfit}%*`,
    { parse_mode: "Markdown" }
  );
});

// 🛠 Setup inline keyboards (strategies, assets, etc.)
setupTelegramHandlers(bot, telegramChatId);

// ✅ Keep server alive on Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Exness Bot server running on port ${PORT}`);
});