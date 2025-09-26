// index.js
import express from "express";
import { Telegraf } from "telegraf";
import { telegramToken, telegramChatId } from "./config.js";

if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN missing");
  process.exit(1);
}

const bot = new Telegraf(telegramToken);
const app = express();
app.use(express.json());

// --- Basic command (to test bot) ---
bot.start((ctx) => ctx.reply("🚀 Bot started with webhook! You will now receive signals here."));

// --- Handle normal text messages ---
bot.on("text", (ctx) => {
  ctx.reply(`📩 You said: ${ctx.message.text}`);
});

// --- TradingView Webhook (NEW) ---
app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const asset = payload.asset || payload.symbol || "UNKNOWN";
    const action = (payload.decision || payload.action || payload.side || payload.signal || "").toUpperCase();
    const comment = payload.comment || payload.note || "";

    const msg = `📡 *Signal Received*\n📊 Asset: ${asset}\n📌 Action: ${action || "—"}${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.telegram.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    } else {
      console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send signal");
    }

    res.json({ ok: true, sent: telegramChatId });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Auto Signal Generator (every 5 min) ---
function generateRandomSignal() {
  const assets = ["EUR/USD", "GBP/JPY", "BTC/USDT", "XAU/USD"];
  const actions = ["BUY", "SELL"];
  const asset = assets[Math.floor(Math.random() * assets.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  return { asset, action };
}

function startAutoSignals() {
  setInterval(async () => {
    if (!telegramChatId) return;

    const { asset, action } = generateRandomSignal();
    const msg = `⚡ *Auto Signal*\n📊 Asset: ${asset}\n📌 Action: ${action}`;
    try {
      await bot.telegram.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
      console.log("✅ Auto signal sent:", asset, action);
    } catch (err) {
      console.error("❌ Failed to send auto signal:", err.message);
    }
  }, 5 * 60 * 1000); // every 5 minutes
}

startAutoSignals();

// --- Set Telegram webhook ---
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  const webhookPath = "/telegram-webhook";
  bot.telegram.setWebhook(`${RENDER_URL}${webhookPath}`)
    .then(() => console.log(`✅ Webhook set: ${RENDER_URL}${webhookPath}`))
    .catch(err => console.error("❌ Webhook error:", err));

  // Attach webhook to Express
  app.use(bot.webhookCallback(webhookPath));
} else {
  console.warn("⚠️ RENDER_EXTERNAL_URL not set, webhook may fail.");
}

// --- Home ---
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Auto signals + Webhooks active");
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));