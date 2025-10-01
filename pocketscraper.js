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
const COOKIES_PATH = "./cookies.json";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

/* ---------- Browser launcher ---------- */
async function launchBrowser() {
  const headlessMode = process.env.FIRST_RUN === "true" ? false : true;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: headlessMode,
    defaultViewport: chromium.defaultViewport,
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  console.log(`✅ Puppeteer launched (headless=${headlessMode})`);
  return browser;
}

/* ---------- Load cookies.json if exists ---------- */
async function tryLoadCookiesFromFile(page) {
  try {
    if (!fs.existsSync(COOKIES_PATH)) {
      console.log("⚠️ No cookies.json file found.");
      return false;
    }
    const raw = fs.readFileSync(COOKIES_PATH, "utf8");
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

/* ---------- Save cookies.json ---------- */
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log("💾 Cookies saved to cookies.json");
  } catch (err) {
    console.error("❌ Failed to save cookies:", err.message);
  }
}

/* ---------- Login & get authenticated page ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  console.log("🌐 Navigating to login page...");
  await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });

  // First try cookies.json
  const loaded = await tryLoadCookiesFromFile(page);
  if (loaded) {
    await page.reload({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {});
    const stillHasLogin = !!(await page.$("#email"));
    if (!stillHasLogin) {
      console.log("✅ Authenticated with cookies.json");
      await saveAndSendScreenshot(page, "already_logged_in.png", "✅ Authenticated (cookies.json)");
      return page;
    }
    console.log("⚠️ Cookies invalid — falling back to email/password...");
  }

  // Manual login case (FIRST_RUN=true)
  if (process.env.FIRST_RUN === "true") {
    console.log("🔑 Please log in manually (solve captcha if shown)...");
    await page.waitForNavigation({ waitUntil: "networkidle2" }); // wait until user logs in
    await saveCookies(page);
    await saveAndSendScreenshot(page, "manual_login.png", "✅ Manual login complete, cookies saved");
    return page;
  }

  // Email/password fallback
  if (EMAIL && PASSWORD) {
    console.log("🔍 Filling login form with EMAIL/PASSWORD...");
    if (await page.$("#email")) await page.type("#email", EMAIL, { delay: 80 });
    if (await page.$("#password")) await page.type("#password", PASSWORD, { delay: 80 });

    await Promise.all([
      page.click("button[type='submit']").catch(() => {}),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {
        console.warn("⚠️ Navigation after login didn’t complete — maybe AJAX or captcha.");
      }),
    ]);

    const stillHasLogin = !!(await page.$("#email"));
    if (stillHasLogin) {
      await saveAndSendScreenshot(page, "error_login.png", "❌ Login failed (captcha or bad credentials)");
      throw new Error("Login failed — captcha or bad credentials");
    }

    console.log("✅ Login successful via EMAIL/PASSWORD");
    await saveAndSendScreenshot(page, "login_success.png", "✅ Login successful (EMAIL/PASSWORD)");

    await saveCookies(page);
    return page;
  } else {
    throw new Error("❌ No cookies.json and no EMAIL/PASSWORD provided.");
  }
}

/* ---------- Fetch signals ---------- */
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