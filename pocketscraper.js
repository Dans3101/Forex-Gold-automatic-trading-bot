// pocketscraper.js (simplified with Telegram screenshots, no captcha)
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import TelegramBot from "node-telegram-bot-api";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const NAV_TIMEOUT = 60000;
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: true }) : null;

let botState = { status: "idle", stopFlag: false };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- Screenshot helper ---------- */
async function saveAndSendScreenshot(page, filename, caption = "") {
  try {
    if (!page.isClosed()) {
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
      if (bot && TELEGRAM_CHAT_ID) {
        await bot.sendPhoto(TELEGRAM_CHAT_ID, filename, { caption });
        console.log(`📤 Screenshot sent to Telegram: ${filename}`);
      }
    }
  } catch (err) {
    console.error("❌ Screenshot error:", err.message);
  }
}

/* ---------- Browser launcher ---------- */
async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: chromium.defaultViewport,
    ignoreDefaultArgs: ["--disable-extensions"],
  });
}

/* ---------- Login handler ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116 Safari/537.36"
  );

  // Go to login page
  console.log("🌐 Navigating to login page...");
  await page.goto("https://pocketoption.com/en/login/", {
    waitUntil: "networkidle2",
    timeout: NAV_TIMEOUT,
  });

  await saveAndSendScreenshot(page, "login_page.png", "📸 Login page");

  // Fill credentials
  if (EMAIL && PASSWORD) {
    await page.type("#email", EMAIL, { delay: 50 });
    await page.type("#password", PASSWORD, { delay: 50 });
  } else {
    throw new Error("❌ No credentials provided (set POCKET_EMAIL and POCKET_PASSWORD)");
  }

  await saveAndSendScreenshot(page, "filled_form.png", "📸 Credentials filled");

  // Submit login form
  await Promise.all([
    page.click("button[type='submit']").catch(() => {}),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {}),
  ]);

  // Screenshot after login
  await saveAndSendScreenshot(page, "dashboard.png", "📸 After login");

  if (await page.$("#email")) {
    throw new Error("❌ Login failed (still on login page)");
  }

  return page;
}

/* ---------- Main Export ---------- */
export async function getPocketData() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser;
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);

      botState.status = "scraping";
      console.log("🔎 Extracting market data...");

      // Example scraping: assets from page text
      const pageText = await page.evaluate(() => document.body?.innerText || "");
      const pageAssets = [...pageText.matchAll(/\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g)]
        .map(m => m[1])
        .slice(0, 10);

      if (!pageAssets.length) {
        await saveAndSendScreenshot(page, "error_no_assets.png", "⚠️ No assets found");
        return [];
      }

      const results = [];
      for (const asset of pageAssets) {
        if (botState.stopFlag) {
          console.log("🛑 Stop command received, halting scrape.");
          break;
        }
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);
        await sleep(ASSET_DELAY);
      }

      botState.status = "idle";
      return results;
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed:`, err.message);
      if (attempt === MAX_RETRIES) return [];
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}

/* ---------- Telegram Command Handlers ---------- */
if (bot) {
  bot.on("message", async (msg) => {
    const text = msg.text?.trim().toLowerCase();
    if (!text) return;

    if (text === ".stop") {
      botState.stopFlag = true;
      await bot.sendMessage(msg.chat.id, "🛑 Bot stop command received.");
    }
    if (text === ".status") {
      const stateMsg = `📊 Bot Status: ${botState.status}`;
      await bot.sendMessage(msg.chat.id, stateMsg);
    }
  });
}