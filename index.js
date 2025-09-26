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

// --- Configure webhook for Telegram ---
const RENDER_URL =
  process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;

if (RENDER_URL) {
  const webhookUrl = `${RENDER_URL}/bot${telegramToken}`;
  console.log("⚙️ Setting Telegram webhook:", webhookUrl);

  bot
    .setWebHook(webhookUrl)
    .then(() => {
      console.log("✅ Telegram webhook set successfully");
    })
    .catch((err) => {
      console.error("❌ Failed to set webhook:", err.message);
    });
} else {
  console.warn("⚠️ RENDER_URL not set, Telegram webhook may fail");
}

// --- Pass bot instance to botManager ---
startBot(bot);

// --- Route: Telegram Webhook ---
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Route: TradingView Webhook (for live signals) ---
app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const asset = payload.asset || payload.symbol || "UNKNOWN";
    const action = (
      payload.decision ||
      payload.action ||
      payload.side ||
      payload.signal ||
      ""
    ).toUpperCase();
    const comment = payload.comment || payload.note || "";

    // Telegram message format
    const msg = `📡 *TradingView Signal*\n\n📊 Asset: ${asset}\n📌 Action: ${
      action || "—"
    }${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
      console.log("✅ Signal forwarded to Telegram:", msg);
    } else {
      console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send signal");
    }

    res.json({ ok: true, received: payload });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Route: GET webhook (for browser testing) ---
app.get("/webhook", (req, res) => {
  res.send(
    "✅ Webhook endpoint is alive. Use POST requests (TradingView alerts) to send signals."
  );
});

// --- Home route ---
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram + TradingView webhook ready 🚀");
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));