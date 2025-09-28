// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketSignals } from "./pocketscraper.js";

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

// --- Pass bot to manager (commands: .on, .off, etc.) ---
const botState = startBot(bot);

// --- Route: Telegram Webhook ---
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Route: TradingView Webhook ---
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

    const msg = `📡 *Signal Received*\n📊 Asset: ${asset}\n📌 Action: ${
      action || "—"
    }${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    } else {
      console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send signal");
    }

    res.json({ ok: true, sent: telegramChatId });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Home route ---
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram + TradingView + PocketScraper ready 🚀");
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// =======================
// 🔄 Auto Scraper Loop
// =======================
async function runScraper() {
  if (!botState.isBotOn()) {
    console.log("⏸️ Bot is OFF (.on to enable) → skipping scrape.");
    return;
  }

  console.log("🔍 Running PocketOption signal scraper...");
  const signals = await getPocketSignals({ onlyStrong: true, limit: 5 });

  if (signals.length > 0 && telegramChatId) {
    for (const s of signals) {
      const msg = `🤖 *Live Chat Signal*\n📊 Asset: ${s.asset}\n📌 Action: ${s.decision}\n💪 Strength: ${s.strength}\n📝 Raw: ${s.raw}`;
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    }
  } else {
    console.log("⚠️ No signals found or TELEGRAM_CHAT_ID missing.");
  }
}

// Schedule scraper
const intervalMs = signalIntervalMinutes * 60 * 1000;
console.log(`⏱️ Scraper scheduled every ${signalIntervalMinutes} minutes.`);

setInterval(runScraper, intervalMs);