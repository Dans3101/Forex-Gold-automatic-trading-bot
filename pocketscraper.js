// pocketscraper.js
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import TelegramBot from "node-telegram-bot-api";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const NAV_TIMEOUT = 180000; // 3 minutes
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000; // 30 seconds

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: true }) : null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------------- Save Telegram Uploaded cookies.json ---------------- */
if (bot) {
  bot.on("document", async (msg) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(TELEGRAM_CHAT_ID)) {
      return bot.sendMessage(chatId, "⚠️ You are not authorized to update cookies.");
    }

    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name;

    if (!fileName.endsWith(".json")) {
      return bot.sendMessage(chatId, "❌ Please upload a valid cookies.json file.");
    }

    try {
      const file = await bot.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

      const response = await fetch(url);
      const data = await response.text();

      fs.writeFileSync("cookies.json", data);
      console.log("💾 New cookies.json saved from Telegram upload.");
      await bot.sendMessage(chatId, "✅ cookies.json updated successfully. Scraper will use these on next run.");
    } catch (err) {
      console.error("❌ Failed to save uploaded cookies:", err.message);
      await bot.sendMessage(chatId, "❌ Failed to save uploaded cookies. Check logs.");
    }
  });
}

/* ---------------- Screenshot Helper ---------------- */
async function saveAndSendScreenshot(page, filename, caption = "") {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    if (bot && TELEGRAM_CHAT_ID) {
      await bot.sendPhoto(TELEGRAM_CHAT_ID, filename, { caption });
      console.log(`📤 Screenshot sent to Telegram: ${filename}`);
    }
  } catch (err) {
    console.error("❌ Screenshot error:", err.message);
  }
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: chromium.defaultViewport,
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  console.log("✅ Puppeteer launched successfully");
  return browser;
}

/* ---------------- Try load cookies from cookies.json ---------------- */
async function tryLoadCookiesFromFile(page) {
  try {
    if (!fs.existsSync("./cookies.json")) {
      console.log("⚠️ No cookies.json file found.");
      return false;
    }
    const raw = fs.readFileSync("./cookies.json", "utf8");
    const cookies = JSON.parse(raw);

    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.log("⚠️ cookies.json is empty.");
      return false;
    }

    await page.setCookie(...cookies);
    console.log(`✅ Injected ${cookies.length} cookies from cookies.json`);
    return true;
  } catch (err) {
    console.error("❌ Failed to load cookies.json:", err.message);
    return false;
  }
}

/* ---------------- Login & get authenticated page ---------------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116 Safari/537.36"
  );
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  console.log("🌐 Navigating to login page...");
  await page.goto("https://pocketoption.com/en/login/", {
    waitUntil: "networkidle2",
    timeout: NAV_TIMEOUT,
  });

  // Try cookies.json
  const loaded = await tryLoadCookiesFromFile(page);
  if (loaded) {
    await page.reload({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {});
    const stillHasLogin = !!(await page.$("#email"));
    if (!stillHasLogin) {
      console.log("✅ Authenticated with cookies.json");
      await saveAndSendScreenshot(page, "already_logged_in.png", "✅ Already authenticated (cookies.json)");
      return page;
    }
    console.log("⚠️ Cookies invalid — fallback blocked by CAPTCHA.");
    throw new Error("Cookies expired. Please upload new cookies.json via Telegram.");
  }

  throw new Error("❌ No cookies.json found. Upload one via Telegram to continue.");
}

/* ---------------- Fetch market data ---------------- */
export async function getPocketData() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser;
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);

      console.log("🔎 Extracting market data...");
      const pageText = await page.evaluate(() => document.body?.innerText || "");
      const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
      const assets = [...pageText.matchAll(assetRE)].map(m => m[1]).slice(0, 10);

      if (!assets.length) {
        await saveAndSendScreenshot(page, "error_no_assets.png", "⚠️ No assets found on dashboard");
        return [];
      }

      const results = [];
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);

        if (i === 0 || i === assets.length - 1) {
          await saveAndSendScreenshot(page, `asset_${asset}.png`, `📊 Asset: ${asset}, Decision: ${decision}`);
        }

        await sleep(ASSET_DELAY);
      }

      return results;
    } catch (err) {
      console.error(`❌ getPocketData attempt ${attempt} failed:`, err.message);
      if (attempt === MAX_RETRIES) return [];
      console.log("🔁 Retrying...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}