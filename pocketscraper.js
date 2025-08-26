// pocketscraper.js
import puppeteer from "puppeteer";
import { email, password, assets } from "./config.js";

export async function getPocketData() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // 🔑 Login
    await page.type("input[name='email']", email, { delay: 50 });
    await page.type("input[name='password']", password, { delay: 50 });
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // 📊 Navigate to trading page
    await page.goto("https://pocketoption.com/en/trading/", {
      waitUntil: "networkidle2",
    });

    // Container for all signals
    const results = [];

    for (let asset of assets) {
      try {
        // 🔄 Switch to asset
        await page.waitForSelector(".asset-selector", { timeout: 15000 });
        await page.click(".asset-selector");

        // Search for the asset in the dropdown
        await page.waitForSelector("input.asset-search", { timeout: 10000 });
        await page.type("input.asset-search", asset, { delay: 50 });

        // Select asset
        await page.waitForSelector(".asset-item", { timeout: 10000 });
        const assetElement = await page.$(".asset-item");
        if (assetElement) {
          await assetElement.click();
        }

        await page.waitForTimeout(3000); // wait for chart update

        // Extract market data
        const data = await page.evaluate(() => {
          const candles = document.querySelectorAll(".highcharts-point");
          if (!candles.length) return null;

          const lastCandle = candles[candles.length - 1];
          const open = parseFloat(lastCandle.getAttribute("data-open")) || 0;
          const close = parseFloat(lastCandle.getAttribute("data-close")) || 0;

          return { open, close };
        });

        let decision = "HOLD";
        if (data) {
          if (data.close > data.open) decision = "BUY";
          else if (data.close < data.open) decision = "SELL";
        }

        results.push({ asset, decision, data });

      } catch (err) {
        console.error(`❌ Error processing ${asset}:`, err.message);
        results.push({ asset, decision: "HOLD", error: err.message });
      }
    }

    return results;

  } catch (err) {
    console.error("❌ Error fetching Pocket Option data:", err);
    return [{ asset: "ALL", decision: "HOLD", error: err.message }];
  } finally {
    if (browser) await browser.close();
  }
}