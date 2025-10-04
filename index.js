// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startExnessBot } from "./exnessBot.js"; 
import { telegramToken, telegramChatId } from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ One Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// ✅ Start Exness bot when server starts
startExnessBot(bot, telegramChatId);

// ✅ Keep server alive on Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Exness Bot server running on port ${PORT}`);
});