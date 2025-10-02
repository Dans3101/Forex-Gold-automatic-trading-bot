// pocketscraper.js (webhook-friendly, screenshots enabled)
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import TelegramBot from "node-telegram-bot-api";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const NAV_TIMEOUT = 180000;
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ✅ No polling (Render already sets webhook in index.js)
const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;

let botState = { status: "idle", waitingCaptcha: false, resumeFlag: false, stopFlag: false };

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

/* ---------- Cookies loader ---------- */
async function tryLoadCookiesFromFile(page) {
  try {
    if (!fs.existsSync("./cookies.json")) {
      console.log("⚠️ No cookies.json file found.");
      return false;
    }
    const cookies = JSON.parse(fs.readFileSync("./cookies.json", "utf8"));
    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.log("⚠️ cookies.json is empty.");
      return false;
    }
    const normalized = cookies.map(c => {
      const copy = { ...c };
      delete copy.unparsed;
      delete copy.creation;
      delete copy.hostOnly;
      delete copy.session;
      return copy;
    });
    await page.setCookie(...normalized);
    console.log(`✅ Injected ${normalized.length} cookies from cookies.json`);
    return true;
  } catch (err) {
    console.error("❌ Failed to load cookies.json:", err.message);
    return false;
  }
}

/* ---------- reCAPTCHA tick helper ---------- */
async function attemptRecaptchaTick(page) {
  try {
    const recaptchaFrame = page.frames().find(f => (f.url() || "").includes("recaptcha"));
    if (!recaptchaFrame) return { ok: true, message: "no-recaptcha" };

    console.log("🧩 reCAPTCHA iframe detected");
    const el = await recaptchaFrame.$("#recaptcha-anchor");
    if (el) {
      await el.click({ delay: 120 });
      console.log("✅ reCAPTCHA checkbox clicked");
      return { ok: true, message: "clicked" };
    }
    return { ok: false, message: "checkbox not found" };
  } catch (err) {
    return { ok: false, message: "error", error: err.message };
  }
}

/* ---------- Login handler ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116 Safari/537.36");

  // 1. Try dashboard directly with cookies
  if (await tryLoadCookiesFromFile(page)) {
    try {
      await page.goto("https://pocketoption.com/en/cabinet/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
      if (!(await page.$("#email"))) {
        console.log("✅ Logged in with cookies.json");
        return page;
      }
    } catch (e) {
      console.warn("⚠️ Cookies auth failed, falling back to login page...");
    }
  }

  // 2. Go to login page if cookies didn’t work
  console.log("🌐 Navigating to login page...");
  await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
  await saveAndSendScreenshot(page, "login_page.png", "📸 Login page opened");

  // Fill credentials
  if (EMAIL && PASSWORD) {
    await page.type("#email", EMAIL, { delay: 80 }).catch(() => {});
    await page.type("#password", PASSWORD, { delay: 80 }).catch(() => {});
    await saveAndSendScreenshot(page, "filled_form.png", "📸 Login form filled");
  } else {
    throw new Error("No credentials provided and cookies.json invalid");
  }

  // Try reCAPTCHA
  const rec = await attemptRecaptchaTick(page);
  if (!rec.ok) {
    botState.waitingCaptcha = true;
    await saveAndSendScreenshot(page, "recaptcha.png", "⚠️ reCAPTCHA challenge, manual action needed");
    if (bot && TELEGRAM_CHAT_ID) {
      await bot.sendMessage(TELEGRAM_CHAT_ID, "⚠️ reCAPTCHA challenge detected. Solve it manually, then send `.resume`.");
    }
    while (!botState.resumeFlag) {
      await sleep(5000);
    }
    botState.waitingCaptcha = false;
  }

  await Promise.all([
    page.click("button[type='submit']").catch(() => {}),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {})
  ]);

  if (await page.$("#email")) {
    throw new Error("Login failed");
  }

  // Save cookies
  const cookies = await page.cookies();
  fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
  console.log("💾 Saved new cookies.json");

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

    if (text === ".resume") {
      botState.resumeFlag = true;
      await bot.sendMessage(msg.chat.id, "▶️ Resuming bot after captcha/manual pause...");
    }
    if (text === ".stop") {
      botState.stopFlag = true;
      await bot.sendMessage(msg.chat.id, "🛑 Bot stop command received.");
    }
    if (text === ".status") {
      const stateMsg = `📊 Bot Status: ${botState.status}\n⚠️ WaitingCaptcha: ${botState.waitingCaptcha}`;
      await bot.sendMessage(msg.chat.id, stateMsg);
    }
  });
}