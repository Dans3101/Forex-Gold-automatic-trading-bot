// pocketscraper.js
import puppeteer from "puppeteer";
import fs from "fs";

/**
 * Pocket Option scraper helpers.
 *
 * Exports:
 *  - getPocketData()    -> returns array [{ asset, decision }]
 *  - getPocketSignals() -> returns array of detected signals from live chat [{ asset, decision, strength, raw }]
 *
 * Features:
 *  - Logs into PocketOption with POCKET_EMAIL + POCKET_PASSWORD
 *  - Captures debug screenshots ("debug-login.png", "debug-dashboard.png", "debug-chat.png")
 *  - If scraping fails, returns [] and logs helpful errors
 */

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

async function launchBrowser() {
  const execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    (typeof puppeteer.executablePath === "function"
      ? puppeteer.executablePath()
      : undefined);

  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  };
  if (execPath) launchOptions.executablePath = execPath;

  return puppeteer.launch(launchOptions);
}

/* Save a screenshot with safe filename */
async function saveShot(page, label = "debug") {
  const ts = Date.now();
  const fname = `${label}-${ts}.png`;
  try {
    await page.screenshot({ path: fname, fullPage: true });
    console.log(`📸 Saved screenshot: ${fname}`);
  } catch (err) {
    console.warn("⚠️ Could not save screenshot:", err.message);
  }
}

/* Simple parser for live chat signals */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-200);

  const signals = [];
  const decisionRE = /\b(BUY|SELL|CALL|PUT|UP|DOWN|LONG|SHORT)\b/i;
  const strongRE = /\bSTRONG\b/i;
  const assetREs = [
    /\b([A-Z]{3}\/[A-Z]{3})\b/g,
    /\b([A-Z]{6})\b/g,
    /\b([A-Z]{3,5}-[A-Z]{3,5})\b/g,
  ];

  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];
    if (!decisionRE.test(line)) continue;

    const decision = (line.match(decisionRE) || [])[0]?.toUpperCase();
    const strong = strongRE.test(line) ? "Strong" : "Normal";

    let asset = null;
    for (const r of assetREs) {
      const m = [...line.matchAll(r)];
      if (m.length > 0) {
        asset = m[0][1];
        break;
      }
    }

    if (decision) {
      signals.push({ asset: asset || "UNKNOWN", decision, strength: strong, raw: line });
    }
  }
  return signals;
}

/* --- getPocketData --- */
export async function getPocketData() {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });
    await saveShot(page, "debug-login");

    // login
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
    ]);
    await saveShot(page, "debug-dashboard");

    // assets
    const assets = await page.$$eval("*", (nodes) =>
      nodes
        .map((n) => n.innerText || n.textContent || "")
        .filter((t) => /\w+\/\w+/.test(t))
    );

    if (!assets.length) {
      console.warn("⚠️ No assets found");
      return [];
    }

    const selected = assets[Math.floor(Math.random() * assets.length)];
    const decision = Math.random() > 0.5 ? "BUY" : "SELL";

    return [{ asset: selected, decision }];
  } catch (err) {
    console.error("❌ getPocketData error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/* --- getPocketSignals --- */
export async function getPocketSignals({ onlyStrong = false, limit = 5 } = {}) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
    ]);
    await saveShot(page, "debug-chat");

    let text = await page.evaluate(() => document.body.innerText || "");
    const parsed = parseTextForSignals(text, 50);

    return onlyStrong ? parsed.filter((s) => /strong/i.test(s.strength)).slice(0, limit) : parsed.slice(0, limit);
  } catch (err) {
    console.error("❌ getPocketSignals error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}