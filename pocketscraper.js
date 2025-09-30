// pocketscraper.js
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

/* ---------- Helpers ---------- */
async function launchBrowser() {
  try {
    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      headless: chromium.headless,
      executablePath,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
    });

    console.log("✅ Puppeteer launched with @sparticuz/chromium");
    return browser;
  } catch (err) {
    console.error("❌ Puppeteer failed to launch:", err.message);
    throw err;
  }
}

/* ---------- Parse chat text for UP/DOWN signals ---------- */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];

  console.log("📝 RAW chat text preview:", text.slice(0, 300).replace(/\s+/g, " "));

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-300);

  const signals = [];
  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];

    let decision = null;
    if (/up|call|buy|⬆️/i.test(line)) decision = "⬆️ UP";
    if (/down|put|sell|⬇️/i.test(line)) decision = "⬇️ DOWN";

    if (decision) {
      const strength = /strong/i.test(line) ? "Strong" : "Normal";
      signals.push({ asset: "UNKNOWN", decision, strength, raw: line });
    }
  }
  return signals;
}

/* ---------- Public Functions ---------- */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - skipping.");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    console.log("🔑 Navigating to Pocket Option login...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    console.log("🔐 Logging in...");
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
    ]);

    console.log("📥 Extracting signals from page text...");
    const text = await page.evaluate(() => document.body?.innerText || "");
    const parsed = parseTextForSignals(text, limit);

    console.log(`✅ Parsed ${parsed.length} signals.`);
    return parsed;
  } catch (err) {
    console.error("❌ getPocketSignals error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function getPocketData() {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - skipping.");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    console.log("🔑 Navigating for market data...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
    ]);

    const pageText = await page.evaluate(() => document.body?.innerText || "");
    const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
    const assets = [...pageText.matchAll(assetRE)].map((m) => m[1]).slice(0, 50);

    if (!assets.length) {
      console.warn("⚠️ No assets found on page.");
      return [];
    }

    const asset = assets[Math.floor(Math.random() * assets.length)];
    const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";

    console.log("📊 Picked sample:", { asset, decision });
    return [{ asset, decision }];
  } catch (err) {
    console.error("❌ getPocketData error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}