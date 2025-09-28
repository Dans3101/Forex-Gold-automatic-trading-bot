// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData } from "./pocketscraper.js";

dotenv.config();

const app = express();
app.use(express.json());

// --- Validate config ---
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN missing. Please set TELEGRAM_TOKEN in environment.");
  process.exit(1);
}

// Create bot (webhook mode)
const bot = new TelegramBot(telegramToken, {
  polling: false,
  webHook: true,
});

// --- Telegram webhook route (Telegram will POST updates here) ---
app.post(`/bot${telegramToken}`, async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error processing Telegram update:", err);
    res.sendStatus(500);
  }
});

// --- TradingView / external webhook for direct signals ---
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

    const msg = `📡 *Signal Received*\n📊 Asset: ${asset}\n📌 Action: ${action || "—"}${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
      console.log("✅ Forwarded webhook signal to chat:", telegramChatId);
    } else {
      console.warn("⚠️ TELEGRAM_CHAT_ID missing — incoming webhook received but no chat to send to.");
    }

    res.json({ ok: true, sentTo: telegramChatId || null });
  } catch (err) {
    console.error("❌ /webhook handler error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Home route ---
app.get("/", (req, res) => {
  res.send("✅ Bot is live — Telegram webhook + TradingView webhook ready 🚀");
});

// --- Start bot manager BEFORE starting the scraper loop ---
// startBot should attach message handlers and return an object with isBotOn()
const botState = startBot(bot) || { isBotOn: () => false };

// --- Start server and then set Telegram webhook (ensures route exists when Telegram calls it) ---
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server listening on port ${PORT}`);

  // Determine public URL for Render
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INTERNAL_URL;
  if (RENDER_URL) {
    const webhookUrl = `${RENDER_URL}/bot${telegramToken}`;
    console.log("⚙️ Setting Telegram webhook to:", webhookUrl);

    try {
      await bot.setWebHook(webhookUrl);
      console.log("✅ Telegram webhook set successfully");
    } catch (err) {
      console.error("❌ Failed to set Telegram webhook:", err && err.message ? err.message : err);
    }
  } else {
    console.warn("⚠️ No RENDER_EXTERNAL_URL/INTERNAL_URL detected — webhook may not be reachable.");
  }
});

// =======================
// 🔄 Auto Scraper Loop
// =======================
async function runScraperOnce() {
  try {
    if (!botState.isBotOn()) {
      console.log("⏸️ Bot is OFF (.on to enable) → skipping scrape.");
      return;
    }

    console.log("🔍 Running Pocket Option scraper...");
    const signals = await getPocketData();

    if (signals?.length > 0) {
      if (!telegramChatId) {
        console.warn("⚠️ TELEGRAM_CHAT_ID not set — scraped signals won't be sent.");
      } else {
        for (const s of signals) {
          try {
            const msg = `🤖 *Scraped Signal*\n📊 Asset: ${s.asset}\n📌 Action: ${s.decision}`;
            await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
            console.log("➡️ Sent scraped signal to chat:", telegramChatId, s.asset, s.decision);
          } catch (err) {
            console.error("❌ Failed to send scraped signal:", err);
          }
        }
      }
    } else {
      console.log("⚠️ No signals found this cycle.");
    }
  } catch (err) {
    console.error("❌ Error in scraper run:", err);
  }
}

// Schedule scraper to run every interval — it internally checks botState.isBotOn()
const intervalMs = Math.max(1, Number(signalIntervalMinutes || 5)) * 60 * 1000;
console.log(`⏱️ Scraper scheduled every ${intervalMs / 60000} minute(s).`);
setInterval(() => {
  // run in background, don't await (we handle errors inside)
  runScraperOnce();
}, intervalMs);

// Optionally run it once at startup (only if bot is already ON)
setTimeout(() => {
  if (botState.isBotOn && botState.isBotOn()) {
    runScraperOnce();
  }
}, 5000);

// --- graceful shutdown ---
process.on("SIGINT", () => {
  console.log("SIGINT received — shutting down");
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down");
  server.close(() => process.exit(0));
});