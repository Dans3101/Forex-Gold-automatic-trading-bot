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

const bot = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN, { polling: false }) : null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function saveAndSendScreenshot(page, filename, caption = "") {
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    if (bot && TELEGRAM_CHAT_ID) {
      try {
        await bot.sendPhoto(TELEGRAM_CHAT_ID, filename, { caption });
        console.log(`📤 Screenshot sent to Telegram: ${filename}`);
      } catch (err) {
        console.warn("❌ Failed to send screenshot to Telegram:", err.message);
      }
    }
  } catch (err) {
    console.error("❌ Screenshot error:", err.message);
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

/* ---------- Load cookies if available ---------- */
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

    // remove problematic fields that puppeteer may reject
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

/* ---------- parse text for signals ---------- */
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

/* ---------- Attempt to tick reCAPTCHA checkbox inside its iframe ---------- */
async function attemptRecaptchaTick(page, timeout = 20000) {
  try {
    // find recaptcha-related frames
    const recaptchaFrame = page.frames().find(f => {
      const url = (f.url() || "").toLowerCase();
      return url.includes("recaptcha") || url.includes("google.com/recaptcha");
    });

    if (!recaptchaFrame) {
      return { ok: true, message: "no-recaptcha" };
    }

    console.log("🧩 reCAPTCHA iframe detected:", recaptchaFrame.url());

    // selectors that commonly represent the checkbox
    const selectors = ["#recaptcha-anchor", ".recaptcha-checkbox-border", "div[role='checkbox']"];

    // try clicking inside the recaptcha frame
    for (const sel of selectors) {
      try {
        const el = await recaptchaFrame.$(sel);
        if (el) {
          console.log(`🖱️ Clicking reCAPTCHA checkbox selector: ${sel}`);
          await el.click({ delay: 120 });
          break;
        }
      } catch (e) {
        // ignore and continue
      }
    }

    // wait for a token to appear in the main document's textarea #g-recaptcha-response
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const token = await page.evaluate(() => {
        const ta = document.querySelector("#g-recaptcha-response");
        return ta ? ta.value : "";
      });

      if (token && token.trim().length > 20) {
        console.log("✅ reCAPTCHA token obtained (checkbox succeeded)");
        return { ok: true, message: "solved", token };
      }

      // detect likely image challenge by checking frames for challenge-like urls
      const challengeFrame = page.frames().find(f => {
        const u = (f.url() || "").toLowerCase();
        return /fallback|bframe|image|challenge|captcha/i.test(u);
      });
      if (challengeFrame) {
        console.warn("⚠️ reCAPTCHA image challenge likely detected (frame):", challengeFrame.url());
        return { ok: false, message: "challenge", frameUrl: challengeFrame.url() };
      }

      await new Promise(r => setTimeout(r, 500));
    }

    console.warn("⚠️ Timeout waiting for reCAPTCHA token");
    return { ok: false, message: "timeout" };
  } catch (err) {
    console.error("❌ attemptRecaptchaTick error:", err.message);
    return { ok: false, message: "error", error: err.message };
  }
}

/* ---------- Login & get authenticated page ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116 Safari/537.36");
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  console.log("🌐 Navigating to login page...");
  try {
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
  } catch (err) {
    console.error("❌ Navigation to login failed:", err.message);
    await saveAndSendScreenshot(page, "error_timeout.png", "❌ Navigation timeout when opening login page");
    throw err;
  }

  // Try cookies first
  const loaded = await tryLoadCookiesFromFile(page);
  if (loaded) {
    try {
      await page.reload({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    } catch (_) {}
    const stillHasLogin = !!(await page.$('input[name="email"], input[type="email"], #email'));
    if (!stillHasLogin) {
      console.log("✅ Authenticated with cookies.json");
      await saveAndSendScreenshot(page, "already_logged_in.png", "✅ Already authenticated (cookies.json)");
      return page;
    }
    console.log("⚠️ cookies.json didn't authenticate — falling back to typed login");
  }

  // typed login path
  if (!EMAIL || !PASSWORD) {
    await saveAndSendScreenshot(page, "error_no_credentials.png", "⚠️ Missing EMAIL/PASSWORD and cookies.json");
    throw new Error("Missing credentials and no valid cookies.json");
  }

  console.log("🔍 Filling login form...");
  try {
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
  } catch (err) {
    console.error("❌ Typing credentials failed:", err.message);
    await saveAndSendScreenshot(page, "error_typing.png", "❌ Typing credentials failed");
    throw err;
  }

  // If reCAPTCHA exists, attempt to tick it before submitting
  const recaptchaFrame = page.frames().find(f => (f.url() || "").toLowerCase().includes("recaptcha"));
  if (recaptchaFrame) {
    console.log("🧩 reCAPTCHA detected - trying to tick checkbox...");
    const rec = await attemptRecaptchaTick(page, 20000);
    if (!rec.ok) {
      console.warn("⚠️ reCAPTCHA challenge or failure:", rec.message);
      await saveAndSendScreenshot(page, "recaptcha_challenge.png", `⚠️ reCAPTCHA challenge (${rec.message})`);
      if (bot && TELEGRAM_CHAT_ID) {
        await bot.sendMessage(TELEGRAM_CHAT_ID, "⚠️ reCAPTCHA challenge detected. I cannot solve image puzzles. Please log in manually and upload cookies.json, or solve the challenge from a browser.");
      }
      throw new Error("reCAPTCHA challenge detected - manual intervention required");
    } else {
      console.log("✅ reCAPTCHA checkbox ticked / token found - proceeding.");
    }
  }

  // submit login (may be AJAX)
  try {
    await Promise.all([
      page.click("button[type='submit']").catch(() => {}),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {
        console.warn("⚠️ Navigation after login didn't complete (AJAX or redirect).");
      })
    ]);
  } catch (err) {
    console.warn("⚠️ Error during submit/navigation:", err.message);
  }

  // check if still on login form
  const stillHasLogin = !!(await page.$('input[name="email"], input[type="email"], #email'));
  if (stillHasLogin) {
    console.error("❌ Still on login page after submit - login failed or blocked");
    await saveAndSendScreenshot(page, "error_login.png", "❌ Login failed (captcha or bad credentials)");
    if (bot && TELEGRAM_CHAT_ID) {
      await bot.sendMessage(TELEGRAM_CHAT_ID, "❌ Login failed — still on login page. Possible captcha or wrong credentials.");
    }
    throw new Error("Login failed - credentials or captcha");
  }

  // success: save cookies
  try {
    await saveAndSendScreenshot(page, "login_success.png", "✅ Login successful");
    const cookies = await page.cookies();
    fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
    console.log("💾 New cookies saved to cookies.json");
  } catch (e) {
    console.warn("⚠️ Failed to save/send login success artifacts:", e.message);
  }

  return page;
}

/* ---------- Main exported: getPocketData ---------- */
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
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL"; // placeholder logic
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
      console.log("🔁 Retrying getPocketData...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}

/* ---------- Main exported: getPocketSignals ---------- */
export async function getPocketSignals(limit = 5) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let browser;
    try {
      browser = await launchBrowser();
      const page = await loginAndGetPage(browser);
      const text = await page.evaluate(() => document.body?.innerText || "");
      return parseTextForSignals(text, limit);
    } catch (err) {
      console.error(`❌ getPocketSignals attempt ${attempt} failed:`, err.message);
      if (attempt === MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketSignals...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}