// pocketscraper.js
import puppeteer from "puppeteer";
import { email, password } from "./config.js";

export async function getPocketData() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Go to Pocket Option login
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // Login
    await page.type('input[name="email"]', email, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Wait for dashboard to load (adjust selector if needed)
    await page.waitForSelector(".asset-title", { timeout: 20000 });

    // Scrape available assets
    const assets = await page.$$eval(".asset-title", (nodes) =>
      nodes.map((n) => n.innerText.trim())
    );

    // If no assets found
    if (!assets || assets.length === 0) {
      await browser.close();
      return [];
    }

    // Pick a random asset
    const randomIndex = Math.floor(Math.random() * assets.length);
    const selectedAsset = assets[randomIndex];

    // Generate random decision
    const decision = Math.random() > 0.5 ? "BUY" : "SELL";

    await browser.close();

    return [
      {
        asset: selectedAsset,
        decision,
      },
    ];
  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err.message);
    await browser.close();
    return [];
  }
}