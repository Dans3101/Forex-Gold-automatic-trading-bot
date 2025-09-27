// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import puppeteer from "puppeteer";
import { startBot } from "./botManager.js";
import {
  telegramToken,
  telegramChatId,
  signalIntervalMinutes,
  email,
  password,
} from "./config.js";

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

// --- Pass bot to botManager ---
startBot(bot);

// --- Route: Telegram Webhook ---
app.post(`/bot${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Route: TradingView Webhook (external signals) ---
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

    const msg = `📡 *TradingView Signal*\n📊 Asset: ${asset}\n📌 Action: ${
      action || "—"
    }${comment ? `\n💬 ${comment}` : ""}`;

    if (telegramChatId) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    }

    res.json({ ok: true, sent: telegramChatId });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Scraper: Pocket Option signals ---
async function scrapePocketOption() {
  try {
    console.log("🔍 Launching scraper...");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Login (optional if signals page is public)
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    if (email && password) {
      await page.type('input[name="email"]', email, { delay: 50 });
      await page.type('input[name="password"]', password, { delay: 50 });
      await page.click("button[type=submit]");
      await page.waitForNavigation({ waitUntil: "networkidle2" });
    }

    // Example: navigate to assets or signals page
    await page.goto("https://pocketoption.com/en/trading/", {
      waitUntil: "networkidle2",
    });

    // Dummy scrape: Replace with real selector for signals
    const data = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".asset-item"))
        .slice(0, 3) // grab top 3
        .map((el) => ({
          name: el.querySelector(".name")?.innerText || "Unknown",
          percent: el.querySelector(".percent")?.innerText || "N/A",
        }));
    });

    console.log("📊 Scraped data:", data);

    if (telegramChatId && data.length > 0) {
      await bot.sendMessage(
        telegramChatId,
        `📡 *Pocket Option Scraper*\n\n${data
          .map((d) => `• ${d.name}: ${d.percent}`)
          .join("\n")}`,
        { parse_mode: "Markdown" }
      );
    }

    await browser.close();
  } catch (err) {
    console.error("❌ Scraper error:", err);
  }
}

// Run scraper every N minutes
if (signalIntervalMinutes > 0) {
  setInterval(scrapePocketOption, signalIntervalMinutes * 60 * 1000);
}

// --- Home route ---
app.get("/", (req, res) => {
  res.send("✅ Bot live — TradingView + Pocket Option scraping active 🚀");
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));