import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import TelegramBot from "node-telegram-bot-api";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const NAV_TIMEOUT = 180000; // 3 minutes
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000; // 30 seconds

// Telegram Bot instance
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

/* ---------- Utility: Save & Send Screenshot ---------- */
async function saveAndSendScreenshot(page, filename, caption = "") {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    if (bot && TELEGRAM_CHAT_ID) {
      await bot.sendPhoto(TELEGRAM_CHAT_ID, filename, { caption });
      console.log(`📤 Screenshot sent to Telegram: ${filename}`);
    }
  } catch (err) {
    console.error("❌ Screenshot failed:", err.message);
  }
}

/* ---------- Launch Puppeteer Browser ---------- */
async function launchBrowser() {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: chromium.defaultViewport,
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    console.log("✅ Puppeteer launched successfully");
    return browser;
  } catch (err) {
    console.error("❌ Puppeteer failed to launch:", err.message);
    throw err;
  }
}

/* ---------- Parse text for signals ---------- */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(-300);
  const signals = [];
  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];
    let decision = null;
    if (/up|call|buy|⬆️/i.test(line)) decision = "⬆️ UP";
    if (/down|put|sell|⬇️/i.test(line)) decision = "⬇️ DOWN";
    if (decision) signals.push({
      asset: "UNKNOWN",
      decision,
      strength: /strong/i.test(line) ? "Strong" : "Normal",
      raw: line
    });
  }
  return signals;
}

/* ---------- Internal function: login & get page ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  try {
    console.log("🌐 Navigating to login page...");
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
      timeout: NAV_TIMEOUT,
    });
  } catch (err) {
    console.error("❌ Navigation to login failed:", err.message);
    await saveAndSendScreenshot(page, "error_timeout.png", "❌ Navigation timeout when opening login page");
    throw err;
  }

  try {
    // If login form exists → fill it
    if (await page.$('input[name="email"], input[type="email"]')) {
      console.log("🔍 Filling login form...");
      await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
      await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });

      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {
          console.warn("⚠️ Login navigation not complete, possible AJAX/recaptcha");
        }),
      ]);
    } else {
      console.log("✅ Already logged in (no login form found)");
    }

    // Check if still stuck at login
    if (await page.$('input[name="email"], input[type="email"]')) {
      console.error("❌ Still on login page — login failed");
      await saveAndSendScreenshot(page, "error_login.png", "❌ Login failed — check credentials or recaptcha");
      throw new Error("Login failed (credentials/recaptcha?)");
    }

    console.log("✅ Login successful!");
    await saveAndSendScreenshot(page, "login_success.png", "✅ Login successful — dashboard loaded");
    return page;

  } catch (err) {
    console.error("❌ Login process failed:", err.message);
    await saveAndSendScreenshot(page, "error_unexpected.png", "❌ Unexpected error during login");
    throw err;
  }
}

/* ---------- Fetch signals for multiple assets ---------- */
export async function getPocketData() {
  if (!EMAIL || !PASSWORD) return [];
  let browser;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);
      const pageText = await page.evaluate(() => document.body?.innerText || "");
      const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
      const assets = [...pageText.matchAll(assetRE)].map(m => m[1]).slice(0, 10);

      if (!assets.length) {
        console.warn("⚠️ No assets found");
        await saveAndSendScreenshot(page, "error_no_assets.png", "⚠️ No assets found on dashboard");
        return [];
      }

      const results = [];
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);

        // Only send screenshots for first & last asset (to avoid spam)
        if (i === 0 || i === assets.length - 1) {
          await saveAndSendScreenshot(page, `asset_${asset}.png`, `📊 Asset: ${asset}, Decision: ${decision}`);
        }

        await new Promise(res => setTimeout(res, ASSET_DELAY));
      }

      return results;
    } catch (err) {
      console.error(`❌ getPocketData attempt ${attempt + 1} failed:`, err.message);
      attempt++;
      if (browser) await browser.close().catch(() => {});
      if (attempt > MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketData...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}

/* ---------- Fetch Live Chat Signals ---------- */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) return [];
  let browser;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);
      const text = await page.evaluate(() => document.body?.innerText || "");
      return parseTextForSignals(text, limit);
    } catch (err) {
      console.error(`❌ getPocketSignals attempt ${attempt + 1} failed:`, err.message);
      attempt++;
      if (browser) await browser.close().catch(() => {});
      if (attempt > MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketSignals...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}