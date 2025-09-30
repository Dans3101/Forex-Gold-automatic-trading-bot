import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

/* ---------- Launch Puppeteer Browser ---------- */
async function launchBrowser() {
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(), // ← must call as a function
      headless: true, // force headless for serverless
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

/* ---------- Fetch Live Chat Signals ---------- */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) return [];
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 })
    ]);

    const text = await page.evaluate(() => document.body?.innerText || "");
    return parseTextForSignals(text, limit);
  } catch (err) {
    console.error("❌ getPocketSignals error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/* ---------- Fetch Market Data ---------- */
export async function getPocketData() {
  if (!EMAIL || !PASSWORD) return [];
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 })
    ]);

    const pageText = await page.evaluate(() => document.body?.innerText || "");
    const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
    const assets = [...pageText.matchAll(assetRE)].map(m => m[1]).slice(0, 50);

    if (!assets.length) return [];
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";
    return [{ asset, decision }];
  } catch (err) {
    console.error("❌ getPocketData error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}