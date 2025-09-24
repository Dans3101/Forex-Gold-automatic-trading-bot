// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken } from "./config.js";

const app = express();

// --- Create Telegram Bot in webhook mode ---
const bot = new TelegramBot(telegramToken, { webHook: true });

// ✅ Tell Telegram to send updates to your Render URL
const RENDER_URL = process.env.RENDER_EXTERNAL_URL; // e.g., https://your-app.onrender.com
bot.setWebHook(`${RENDER_URL}/bot${telegramToken}`);

// ✅ Expose webhook endpoint
app.post(`/bot${telegramToken}`, express.json(), (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Start your trading bot logic ---
startBot(bot);

// ✅ Home route
app.get("/", (req, res) => {
  res.send("✅Pocket Option Bot is Live!Your trading automation is now running smoothly on Render, fully integrated with Telegram via webhook.  
This sleek interface confirms successful deployment and backend connectivity—no errors, no clutter, just clean execution.  
Ideal for traders and developers seeking reliable signal delivery and real-time alerts.  
Whether you're scaling up or just getting started, this bot is built for performance and clarity.  
Stay tuned for updates, enhancements, and community-driven features!");
});

// ✅ Use Render's PORT (default 10000) or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});