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
const POCKET_COOKIES_ENV = process.env.POCKET_COOKIES;
const POCKET_COOKIES_PATH = process.env.POCKET_COOKIES_PATH || "./cookies.json";

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------- Save screenshot locally & send to Telegram ---------- */
async function saveAndSendScreenshot(page, filename, caption = "") {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    if (bot && TELEGRAM_CHAT_ID) {
      try {
        // use read stream to be safe
        await bot.sendPhoto(TELEGRAM_CHAT_ID, fs.createReadStream(filename), { caption });
        console.log(`📤 Screenshot sent to Telegram: ${filename}`);
      } catch (err) {
        console.error("❌ Failed to send screenshot to Telegram:", err.message);
      }
    }
  } catch (err) {
    console.error("❌ Screenshot error:", err.message);
  }
}

/* ---------- Save cookies from the page to cookies.json (do NOT send cookie contents to Telegram) ---------- */
async function saveCookiesFromPage(page) {
  try {
    const cookies = await page.cookies();
    if (!cookies || !cookies.length) {
      console.log("ℹ️ No cookies to save.");
      return false;
    }
    fs.writeFileSync(POCKET_COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log(`✅ Saved ${cookies.length} cookies to ${POCKET_COOKIES_PATH}`);
    if (bot && TELEGRAM_CHAT_ID) {
      // notify without sending cookie content
      await bot.sendMessage(TELEGRAM_CHAT_ID, `✅ Saved session cookies to \`${POCKET_COOKIES_PATH}\`. You can copy this file to your deployment if you prefer.`, { parse_mode: "Markdown" }).catch(()=>{});
    }
    return true;
  } catch (err) {
    console.error("❌ Failed to save cookies:", err.message);
    return false;
  }
}

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

/* ---------- Try load cookies from env or file into page ---------- */
async function tryLoadCookiesToPage(page) {
  try {
    let cookiesJson = null;

    if (POCKET_COOKIES_ENV) {
      cookiesJson = POCKET_COOKIES_ENV;
      console.log("🔁 Using cookies from POCKET_COOKIES env var");
    } else {
      try {
        const raw = fs.readFileSync(POCKET_COOKIES_PATH, "utf8");
        cookiesJson = raw;
        console.log(`🔁 Loaded cookies from file: ${POCKET_COOKIES_PATH}`);
      } catch (e) {
        // file not found -> ignore
      }
    }

    if (!cookiesJson) return false;

    let cookies;
    try {
      cookies = JSON.parse(cookiesJson);
    } catch (e) {
      console.warn("⚠️ POCKET_COOKIES is not valid JSON; skipping cookie load");
      return false;
    }

    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.warn("⚠️ No cookies found in POCKET_COOKIES");
      return false;
    }

    // Normalize & remove fields that may cause setCookie to fail
    const normalized = cookies.map(c => {
      const copy = { ...c };
      delete copy.hostOnly;
      delete copy.session;
      delete copy.storeId;
      // ensure expiry is an integer if present
      if (copy.expires && typeof copy.expires === "string") {
        const intExp = parseInt(copy.expires, 10);
        if (!Number.isNaN(intExp)) copy.expires = intExp;
      }
      return copy;
    });

    await page.setCookie(...normalized);
    console.log(`✅ Injected ${normalized.length} cookies into page`);
    return true;
  } catch (err) {
    console.error("❌ Failed to load cookies:", err.message);
    return false;
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

/* ---------- Login & get authenticated page (uses cookies first) ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  // basic anti-detect headers
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  try {
    console.log("🌐 Navigating to login page (initial)...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
  } catch (err) {
    console.error("❌ Navigation to login failed:", err.message);
    await saveAndSendScreenshot(page, "error_timeout.png", "❌ Navigation timeout when opening login page");
    throw err;
  }

  // Try cookies: if present, inject and reload
  try {
    const loaded = await tryLoadCookiesToPage(page);
    if (loaded) {
      console.log("🔁 Reloading page with injected cookies...");
      await page.reload({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {});
    }
  } catch (e) {
    console.warn("⚠️ Cookie load error:", e.message);
  }

  // check if login form still present
  const hasLoginForm = !!(await page.$('input[name="email"], input[type="email"], #email'));
  if (!hasLoginForm) {
    console.log("✅ No login form found — likely already authenticated by cookies");
    await saveAndSendScreenshot(page, "already_logged_in.png", "✅ Already authenticated (cookies loaded)");
    return page;
  }

  // If login form present, perform manual login (only if no cookies or cookies invalid)
  if (EMAIL && PASSWORD) {
    try {
      console.log("🔍 Filling login form (cookies not valid)...");
      // prefer id selectors if present
      if (await page.$("#email")) {
        await page.type("#email", EMAIL, { delay: 80 });
      } else {
        await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
      }

      if (await page.$("#password")) {
        await page.type("#password", PASSWORD, { delay: 80 });
      } else {
        await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
      }

      // submit
      await Promise.all([
        page.click("button[type='submit']").catch(() => {}),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {
          console.warn("⚠️ Navigation after login didn't complete; page may use AJAX or recaptcha");
        })
      ]);
    } catch (err) {
      console.error("❌ Login selectors/typing failed:", err.message);
      await saveAndSendScreenshot(page, "error_login_selectors.png", "❌ Login typing/selectors failed");
      throw err;
    }

    // verify whether login succeeded
    const stillHasLogin = !!(await page.$('input[name="email"], input[type="email"], #email'));
    if (stillHasLogin) {
      console.error("❌ Still on login page after submit — login failed or blocked by captcha");
      await saveAndSendScreenshot(page, "error_login.png", "❌ Login failed — credentials or captcha");
      throw new Error("Login failed — credentials or captcha");
    }
  } else {
    console.warn("⚠️ EMAIL/PASSWORD not set — cannot perform typed login.");
    await saveAndSendScreenshot(page, "error_no_credentials.png", "⚠️ EMAIL/PASSWORD missing");
    throw new Error("Missing credentials");
  }

  // success: save cookies to file for reuse
  try {
    const saved = await saveCookiesFromPage(page);
    if (!saved) console.warn("⚠️ Login succeeded but cookies not saved.");
  } catch (_) {}

  await saveAndSendScreenshot(page, "login_success.png", "✅ Login successful, dashboard loaded");
  console.log("✅ Login successful");
  return page;
}

/* ---------- Fetch signals for multiple assets ---------- */
export async function getPocketData() {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - skipping.");
    return [];
  }

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
        console.warn("⚠️ No assets found on page.");
        await saveAndSendScreenshot(page, "error_no_assets.png", "⚠️ No assets found on dashboard");
        return [];
      }

      const results = [];
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        // placeholder decision — replace with your logic
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);

        // only send screenshot for first & last asset (avoid spam)
        if (i === 0 || i === assets.length - 1) {
          await saveAndSendScreenshot(page, `asset_${asset}.png`, `📊 Asset: ${asset}, Decision: ${decision}`);
        }

        await sleep(ASSET_DELAY);
      }

      return results;
    } catch (err) {
      console.error(`❌ getPocketData attempt ${attempt} failed:`, err.message);
      if (browser) await browser.close().catch(() => {});
      if (attempt === MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketData...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}

/* ---------- Fetch Live Chat Signals ---------- */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - skipping.");
    return [];
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser;
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);
      const text = await page.evaluate(() => document.body?.innerText || "");
      return parseTextForSignals(text, limit);
    } catch (err) {
      console.error(`❌ getPocketSignals attempt ${attempt} failed:`, err.message);
      if (browser) await browser.close().catch(() => {});
      if (attempt === MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketSignals...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}