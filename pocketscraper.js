import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;
const NAV_TIMEOUT = 180000; // 3 minutes
const MAX_RETRIES = 2;
const ASSET_DELAY = 30000; // 30 seconds

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

  await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });

  // 🔍 DEBUG: dump all form fields
  const formHtml = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("form")).map((form, idx) => {
      return {
        index: idx,
        html: form.outerHTML
      };
    });
  });
  console.log("📄 Login forms found:", JSON.stringify(formHtml, null, 2));

  // 🔍 DEBUG: dump full page HTML (⚠️ can be long!)
  const fullHtml = await page.content();
  console.log("📄 Full page HTML dump START ===");
  console.log(fullHtml.substring(0, 5000)); // limit log to first 5000 chars
  console.log("📄 Full page HTML dump END ===");

  // Try filling credentials
  try {
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT })
    ]);
    console.log("✅ Login attempt complete");
  } catch (err) {
    console.error("❌ Login selectors failed:", err.message);
    throw err;
  }

  return page;
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

      if (!assets.length) return [];

      const results = [];
      for (const asset of assets) {
        const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
        results.push({ asset, decision });
        console.log(`📌 Asset: ${asset}, Decision: ${decision}`);
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