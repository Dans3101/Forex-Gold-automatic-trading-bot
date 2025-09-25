// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId } from "./config.js";

const app = express();
app.use(express.json());

// --- Initialize Telegram Bot ---
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN missing");
  process.exit(1);
}
const bot = new TelegramBot(telegramToken, { webHook: true });

// Webhook for Telegram
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;
if (RENDER_URL) {
  console.log("⚙️ Setting Telegram webhook:", `${RENDER_URL}/bot${telegramToken}`);
  try {
    bot.setWebHook(`${RENDER_URL}/bot${telegramToken}`);
  } catch (e) {
    console.warn("⚠️ setWebHook failed:", e.message);
  }
}

// Keep your botManager features (.on, .off etc.)
startBot(bot);

// --- Route: Telegram Webhook ---
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Route: TradingView Webhook (NEW) ---
// TradingView will POST JSON here when your alert fires
app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const asset = payload.asset || payload.symbol || "UNKNOWN";
    const action = (payload.decision || payload.action || payload.side || payload.signal || "").toUpperCase();
    const comment = payload.comment || payload.note || "";

    const msg = `📡 *Signal Received*\n📊 Asset: ${asset}\n📌 Action: ${action || "—"}${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    } else {
      console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send signal");
    }

    res.json({ ok: true, sent: telegramChatId });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Home
app.get("/", (req, res) => res.send("✅ Bot is live — Webhook ready for TradingView"));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));