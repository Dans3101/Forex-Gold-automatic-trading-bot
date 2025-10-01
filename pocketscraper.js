// pocketscraper.js
import fs from "fs/promises";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const NAV_TIMEOUT = 180000; // 3 minutes
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000; // 30 seconds
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY; // 2captcha api key (optional)
const COOKIES_ENV = process.env.POCKET_COOKIES; // optional JSON string of cookies
const COOKIES_PATH = process.env.POCKET_COOKIES_PATH || "./cookies.json"; // optional file path

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

/* ---------- load cookies if provided via env or file ---------- */
async function tryLoadCookiesToPage(page) {
  try {
    let cookiesJson = null;
    if (COOKIES_ENV) {
      cookiesJson = COOKIES_ENV;
      console.log("🔁 Loading cookies from POCKET_COOKIES env var");
    } else {
      try {
        const raw = await fs.readFile(COOKIES_PATH, "utf8");
        cookiesJson = raw;
        console.log(`🔁 Loaded cookies from file: ${COOKIES_PATH}`);
      } catch (e) {
        // file not found — that's OK
      }
    }

    if (!cookiesJson) return false;

    const cookies = JSON.parse(cookiesJson);
    if (!Array.isArray(cookies)) {
      console.warn("⚠️ POCKET_COOKIES content is not an array; skipping cookie load");
      return false;
    }
    await page.setCookie(...cookies);
    console.log(`✅ Injected ${cookies.length} cookies into page`);
    return true;
  } catch (err) {
    console.error("❌ Failed to load cookies:", err.message);
    return false;
  }
}

/* ---------- 2Captcha solver for reCAPTCHA v2 (if enabled) ---------- */
async function solveRecaptchaWith2Captcha(siteKey, pageUrl) {
  if (!CAPTCHA_API_KEY) throw new Error("No CAPTCHA_API_KEY provided for solving reCAPTCHA");
  console.log("🔐 Submitting reCAPTCHA to 2Captcha (sitekey:", siteKey, ")");

  // Create task
  const inUrl = `http://2captcha.com/in.php?key=${CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${encodeURIComponent(siteKey)}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
  const createRes = await fetch(inUrl);
  const createJson = await createRes.json();
  if (createJson.status !== 1) throw new Error("2Captcha create failed: " + JSON.stringify(createJson));
  const requestId = createJson.request;

  // Poll result
  const resUrl = `http://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${requestId}&json=1`;
  const maxPolls = 24; // ~2 min
  for (let i = 0; i < maxPolls; i++) {
    await sleep(i === 0 ? 20000 : 5000); // 20s initial, then 5s
    const pollRes = await fetch(resUrl);
    const pollJson = await pollRes.json();
    if (pollJson.status === 1) {
      console.log("🔓 2Captcha solved, token received");
      return pollJson.request; // the g-recaptcha-response token
    }
    if (pollJson.request && pollJson.request !== "CAPCHA_NOT_READY") {
      throw new Error("2Captcha error: " + pollJson.request);
    }
    console.log("⏳ Waiting for captcha solution...");
  }
  throw new Error("2Captcha timeout waiting for solution");
}

/* ---------- parseTextForSignals (unchanged) ---------- */
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

/* ---------- Login & return authenticated page ---------- */
async function loginAndGetPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  // apply some anti-detection tweaks per page
  await page.evaluateOnNewDocument(() => {
    // navigator webdriver false
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // languages
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    // plugins stub
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    // chrome object
    window.chrome = { runtime: {} };
  });

  // user agent + headers + viewport
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1366, height: 768 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  console.log("🌐 Navigating to login page...");
  await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });

  // Try to load cookies before typing (so we can skip login if valid)
  try {
    const loaded = await tryLoadCookiesToPage(page);
    if (loaded) {
      // reload page with cookies in place
      await page.reload({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {});
    }
  } catch (e) {
    console.warn("⚠️ cookie load error:", e.message);
  }

  // check if login form still present
  const hasEmail = !!(await page.$("#email")) || !!(await page.$('input[name="email"]')) || !!(await page.$('input[type="email"]'));
  if (!hasEmail) {
    console.log("✅ No login form found — likely already authenticated");
    // screenshot + html snippet
    try {
      await page.screenshot({ path: "already_logged_in.png", fullPage: true });
      console.log("📸 Screenshot saved: already_logged_in.png");
    } catch (e) {}
    const html = await page.content();
    console.log("📄 HTML snapshot (already logged in) START ===");
    console.log(html.substring(0, 2000));
    console.log("📄 HTML snapshot END ===");
    return page;
  }

  console.log("🔍 Filling login form...");

  // detect recaptcha presence BEFORE submission
  const recaptchaWidget = await page.$('.js-recaptcha-widget, .g-recaptcha, iframe[src*="recaptcha"]');
  if (recaptchaWidget) {
    console.log("🔍 Recaptcha detected on login page");
  }

  // fill inputs (use robust selectors)
  try {
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
  } catch (e) {
    console.error("❌ Failed to type credentials:", e.message);
    throw e;
  }

  // If there's an explicit reCAPTCHA and we have a solver key, attempt to solve it BEFORE clicking submit
  let solvedCaptcha = false;
  if (recaptchaWidget && CAPTCHA_API_KEY) {
    try {
      // attempt to extract sitekey from iframe src or data attributes
      const iframe = await page.$('iframe[src*="recaptcha"]');
      let sitekey = null;
      if (iframe) {
        const src = await (await iframe.getProperty("src")).jsonValue();
        try {
          const u = new URL(src);
          sitekey = u.searchParams.get("k") || u.searchParams.get("sitekey") || null;
        } catch (_) {}
      }
      // try to get data-sitekey from widget element
      if (!sitekey) {
        try {
          sitekey = await page.$eval('.js-recaptcha-widget', el => el.getAttribute('data-sitekey'));
        } catch (_) {}
      }

      if (!sitekey) {
        console.warn("⚠️ Could not find reCAPTCHA sitekey automatically; will continue to submit and rely on fallback.");
      } else {
        console.log("🔐 Solving recaptcha (sitekey):", sitekey);
        const token = await solveRecaptchaWith2Captcha(sitekey, "https://pocketoption.com/en/login/");
        // inject token into g-recaptcha-response textarea and trigger callback
        await page.evaluate((t) => {
          const el = document.querySelector('#g-recaptcha-response');
          if (el) {
            el.style.display = 'block';
            el.value = t;
          } else {
            // create hidden textarea if not present
            const ta = document.createElement('textarea');
            ta.id = 'g-recaptcha-response';
            ta.name = 'g-recaptcha-response';
            ta.style.display = 'block';
            ta.value = t;
            document.body.appendChild(ta);
          }
        }, token);
        // try calling verify callback if exists or submit the form
        await page.evaluate(() => {
          try {
            if (typeof verifyCallback === 'function') {
              verifyCallback();
            } else {
              const form = document.querySelector('form');
              if (form) form.dispatchEvent(new CustomEvent('submit', { cancelable: true }));
            }
          } catch (e) {
            // ignore
          }
        });
        solvedCaptcha = true;
        console.log("🔓 Injected captcha token and triggered submission");
      }
    } catch (err) {
      console.error("❌ Recaptcha solving failed:", err.message);
    }
  }

  // If not solved via solver, proceed to click submit (the page may handle recaptcha on submit)
  try {
    // click the primary submit button
    const submitSelector = "button[type='submit'], .submit-btn-wrap button, .btn.btn-green-light";
    await page.click(submitSelector).catch(() => {});
    // try waiting for navigation but don't crash if navigation doesn't occur
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {
      console.warn("⚠️ Navigation after login did not complete (AJAX or recaptcha may be active)");
    });
  } catch (err) {
    console.warn("⚠️ Click submit may have failed:", err.message);
  }

  // After submit, confirm whether we're still on login page
  const stillHasEmail = !!(await page.$("#email")) || !!(await page.$('input[name="email"], input[type="email"]'));
  if (stillHasEmail) {
    // capture debug info
    try {
      await page.screenshot({ path: "login_failed.png", fullPage: true });
      console.log("📸 Screenshot saved: login_failed.png");
      const html = await page.content();
      console.log("📄 HTML snapshot (login failed) START ===");
      console.log(html.substring(0, 2000));
      console.log("📄 HTML snapshot END ===");
    } catch (e) {
      console.warn("⚠️ Failed to capture debug screenshot/html:", e.message);
    }

    // If recaptcha present and unsolved, tell the caller
    if (recaptchaWidget && !solvedCaptcha) {
      throw new Error("Login appears blocked by reCAPTCHA. Provide CAPTCHA_API_KEY or use cookies.");
    }
    throw new Error("❌ Login failed — still on login page (check credentials or recaptcha).");
  }

  // success
  try {
    await page.screenshot({ path: "login_success.png", fullPage: true });
    console.log("📸 Screenshot saved: login_success.png");
    const html = await page.content();
    console.log("📄 HTML snapshot (dashboard) START ===");
    console.log(html.substring(0, 2000));
    console.log("📄 HTML snapshot END ===");
  } catch (e) {}

  console.log("✅ Login successful, dashboard loaded");
  return page;
}

/* ---------- Fetch signals for multiple assets (with retries) ---------- */
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

      const pageText = await page.evaluate(() => document.body?.innerText || "");
      const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
      const assets = [...pageText.matchAll(assetRE)].map(m => m[1]).slice(0, 10);

      if (!assets.length) {
        console.warn("⚠️ No assets found on page.");
        return [];
      }

      const results = [];
      for (const asset of assets) {
        // TODO: replace with real check per-asset (this is placeholder decision logic)
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);
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

/* ---------- Fetch Live Chat Signals (unchanged) ---------- */
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
      if (attempt === MAX_RETRIES) return [];
      console.log("🔁 Retrying getPocketSignals...");
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
  return [];
}