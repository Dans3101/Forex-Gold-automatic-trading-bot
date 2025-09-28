// index.js

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import {
  telegramToken,
  telegramChatId,
  signalIntervalMinutes,
  decisionDelaySeconds,
  email,
  password
} from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

let bot;
let tradingActive = false;
let scraperInterval;

// 🚀 Initialize Telegram Bot
if (telegramToken) {
  bot = new TelegramBot(telegramToken, { polling: true });

  console.log("🚀 Telegram Bot Manager loaded...");
  console.log("👥 Target Chat ID from config:", telegramChatId);

  // Commands
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();

    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    if (text === ".on") {
      tradingActive = true;
      bot.sendMessage(chatId, "✅ Trading bot is now ON");
      startScraper();
    }

    if (text === ".off") {
      tradingActive = false;
      bot.sendMessage(chatId, "🛑 Trading bot is now OFF");
      stopScraper();
    }
  });
}

// 🕵️ Scraper Function
async function scrapePocketOption() {
  console.log("🔍 Launching scraper...");
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://pocketoption.com/en/", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Optional login (if creds set in .env)
    if (email && password) {
      await page.click("a[href='/en/login/']");
      await page.waitForSelector("input[name='email']");
      await page.type("input[name='email']", email, { delay: 50 });
      await page.type("input[name='password']", password, { delay: 50 });
      await page.click("button[type='submit']");
      await page.waitForTimeout(5000);
    }

    // Example scraping — change to what you need
    const title = await page.title();
    console.log("📊 Scraped Page Title:", title);

    if (bot && telegramChatId) {
      await bot.sendMessage(telegramChatId, `📊 PocketOption Page Title: ${title}`);
    }

    await browser.close();
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    if (bot && telegramChatId) {
      bot.sendMessage(telegramChatId, `❌ Scraper error: ${err.message}`);
    }
  }
}

// 🚦 Start & Stop Scraper
function startScraper() {
  if (scraperInterval) clearInterval(scraperInterval);
  scraperInterval = setInterval(scrapePocketOption, signalIntervalMinutes * 60 * 1000);
  console.log("⏳ Scraper started with interval:", signalIntervalMinutes, "minutes");
}

function stopScraper() {
  if (scraperInterval) clearInterval(scraperInterval);
  console.log("🛑 Scraper stopped");
}

// 🌐 Express Server (needed for Render to stay alive)
app.get("/", (req, res) => {
  res.send("🚀 Pocket Option Trading Bot is running!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});