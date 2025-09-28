// pocketscraper.js
import puppeteer from "puppeteer";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

export async function getPocketData() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
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
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    console.log("🌐 Navigating to Pocket Option login...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    // login
    if (!EMAIL || !PASSWORD) {
      throw new Error("Missing POCKET_EMAIL or POCKET_PASSWORD environment variables");
    }

    await page.type('input[name="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"]', PASSWORD, { delay: 80 });
    await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: "networkidle2" })]);

    console.log("🔑 Logged in. Waiting for asset list...");
    await page.waitForSelector(".asset-title", { timeout: 20000 });

    const assets = await page.$$eval(".asset-title", nodes => nodes.map(n => n.innerText.trim()).filter(Boolean));
    if (!assets.length) {
      throw new Error("No assets found.");
    }

    console.log(`✅ Found ${assets.length} assets.`);
    const selectedAsset = assets[Math.floor(Math.random() * assets.length)];

    const delayMs = 5000 + Math.floor(Math.random() * 10000);
    await new Promise(r => setTimeout(r, delayMs));

    const decision = Math.random() > 0.5 ? "BUY" : "SELL";

    await browser.close();
    return [{ asset: selectedAsset, decision }];
  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err && err.message ? err.message : err);
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    return [];
  }
}