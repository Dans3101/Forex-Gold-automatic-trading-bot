// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startBot } from "./botManager.js";     // old Pocket features if still needed
import { startExnessBot } from "./exnessBot.js"; // Exness trading bot
import { telegramToken } from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Single Telegram bot instance
const bot = new TelegramBot(telegramToken, { polling: true });

// Start different modules
if (startBot) {
  startBot(bot);        // Your old bot features (like admin commands, status, etc.)
}

if (startExnessBot) {
  startExnessBot(bot);  // Exness trading bot with strategies
}

// ✅ Express server just to keep Render alive
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
});