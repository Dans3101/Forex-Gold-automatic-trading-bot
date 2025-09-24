// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken } from "./config.js";

const app = express();

// --- Create Telegram Bot in webhook mode ---
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN is missing. Please set it in your environment.");
  process.exit(1);
}

const bot = new TelegramBot(telegramToken, { webHook: true });

// ✅ Get Render external URL
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (!RENDER_URL) {
  console.warn("⚠️ RENDER_EXTERNAL_URL is not set. Webhook may fail.");
}

// ✅ Tell Telegram to send updates to your Render URL
if (RENDER_URL) {
  bot.setWebHook(`${RENDER_URL}/bot${telegramToken}`);
}

// ✅ Expose webhook endpoint
app.post(`/bot${telegramToken}`, express.json(), (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Start trading bot logic (pass bot instance to manager) ---
startBot(bot);

// ✅ Home route
app.get("/", (req, res) => {
  res.send(`
    ✅ Pocket Option Bot is Live!  
    Your trading automation is now running smoothly on Render, fully integrated with Telegram via webhook.  

    This confirms successful deployment and backend connectivity—no errors, no clutter, just clean execution.  
    Ideal for traders and developers seeking reliable signal delivery and real-time alerts.  
    Stay tuned for updates, enhancements, and community-driven features! 🚀
  `);
});

// ✅ Use Render's PORT (default 10000) or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});