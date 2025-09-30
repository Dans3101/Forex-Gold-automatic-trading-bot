// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId } from "./config.js";

// ✅ Puppeteer-core with Chromium path
import puppeteer from "puppeteer-core";
import chromium from "chromium";

const app = express();
app.use(express.json());

// --- Initialize Telegram Bot ---
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN missing");
  process.exit(1);
}

const bot = new TelegramBot(telegramToken, {
  polling: false,
  webHook: true,
});

// --- Configure webhook for Telegram ---
const RENDER_URL =
  process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;

if (RENDER_URL) {
  const webhookUrl = `${RENDER_URL}/bot${telegramToken}`;
  console.log("⚙️ Setting Telegram webhook:", webhookUrl);

  bot
    .setWebHook(webhookUrl)
    .then(() => console.log("✅ Webhook set successfully"))
    .catch((err) => console.error("❌ Failed to set webhook:", err.message));
} else {
  console.warn("⚠️ RENDER_URL not set, Telegram webhook may fail");
}

// --- Pass bot and puppeteer to botManager ---
startBot(bot, puppeteer, chromium.path);

// --- Route: Telegram Webhook ---
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Home route ---
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram + PocketOption Scraper ready 🚀");
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // ✅ Send startup message
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
    console.warn("⚠️ TELEGRAM_CHAT_ID not set, startup message skipped.");
  }
});