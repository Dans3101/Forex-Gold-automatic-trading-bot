// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";   // your old bot features
import { startExnessBot } from "./exnessBot.js"; // new Exness bot
import { telegramToken } from "./config.js";

const app = express();
app.use(express.json());

// ✅ One Telegram bot for everything
const bot = new TelegramBot(telegramToken, { polling: true });

startBot(bot);        // Old bot features
startExnessBot(bot);  // Exness bot

app.listen(3000, () => {
  console.log("🚀 Bot server running on port 3000");
});