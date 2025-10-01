// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId } from "./config.js";

const app = express();
app.use(express.json());

/* ------------------ Telegram Bot Setup ------------------ */
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN missing in config.js or .env");
  process.exit(1);
}

const bot = new TelegramBot(telegramToken, { polling: false, webHook: true });

// Detect Render URL for webhook
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;
if (RENDER_URL) {
  const webhookUrl = `${RENDER_URL}/bot${telegramToken}`;
  console.log("⚙️ Setting Telegram webhook to:", webhookUrl);

  bot.setWebHook(webhookUrl)
    .then(() => console.log("✅ Telegram webhook set successfully"))
    .catch((err) => console.error("❌ Failed to set webhook:", err.message));
} else {
  console.warn("⚠️ No RENDER_URL found. Webhook may not work on Render.");
}

/* ------------------ Start Bot ------------------ */
startBot(bot);

/* ------------------ Express Routes ------------------ */

// Telegram Webhook route
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Home route (health check)
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram + PocketOption Scraper ready 🚀");
});

/* ------------------ Start Server ------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Send startup message if TELEGRAM_CHAT_ID is set
  if (telegramChatId) {
    try {
      await bot.sendMessage(
        telegramChatId,
        "🚀 Bot is online and ready!\n\nUse `.on` to start signal scraping.\nUse `.off` to stop."
      );
      console.log("📩 Startup message sent to Telegram.");
    } catch (err) {
      console.error("❌ Failed to send startup message:", err.message);
    }
  } else {
    console.warn("⚠️ TELEGRAM_CHAT_ID not set — no startup message sent.");
  }
});