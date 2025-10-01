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

/* ------------------ Webhook Setup (Render Compatible) ------------------ */
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;

if (RENDER_URL) {
  const webhookUrl = `${RENDER_URL}/bot${telegramToken}`;
  console.log("⚙️ Setting Telegram webhook to:", webhookUrl);

  bot.setWebHook(webhookUrl)
    .then(() => console.log("✅ Telegram webhook set successfully"))
    .catch((err) => console.error("❌ Failed to set webhook:", err.message));
} else {
  console.warn("⚠️ RENDER_URL not detected — polling/webhook may not work.");
}

/* ------------------ Start Bot ------------------ */
startBot(bot);

/* ------------------ Express Routes ------------------ */

// ✅ Webhook endpoint for Telegram
app.post(`/bot${telegramToken}`, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error processing Telegram update:", err.message);
    res.sendStatus(500);
  }
});

// ✅ Health check / Home route
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram + PocketOption Scraper ready 🚀");
});

/* ------------------ Server Startup ------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // ✅ Send startup message to Telegram only if chat ID exists
  if (telegramChatId) {
    try {
      await bot.sendMessage(
        telegramChatId,
        `🚀 Bot is online!\n\nUse:\n.on → start signals\n.off → stop signals\n\n📌 First Run: ${process.env.FIRST_RUN || "false"}`
      );
      console.log("📩 Startup message sent to Telegram.");
    } catch (err) {
      console.error("❌ Failed to send startup message:", err.message);
    }
  } else {
    console.warn("⚠️ TELEGRAM_CHAT_ID not set — startup message skipped.");
  }
});