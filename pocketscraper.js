import puppeteer from "puppeteer";
import { email, password } from "./config.js";
import technicalindicators from "technicalindicators";

// ===== Login and Get Signal =====
export async function getTradingSignal() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1️⃣ Go to Pocket Option login page
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    // 2️⃣ Login with practice account
    await page.type('input[name="email"]', email, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForSelector(".chart-container", { timeout: 15000 });

    // 3️⃣ Extract candle data (last 50 prices)
    const prices = await page.evaluate(() => {
      // Grab last 50 candles from chart
      const candleElements = Array.from(document.querySelectorAll(".chart-container .candle"));
      const closePrices = candleElements
        .slice(-50)
        .map(candle => parseFloat(candle.getAttribute("data-close")));
      return closePrices;
    });

    // 4️⃣ Strategy
    const rsi = technicalindicators.RSI.calculate({ values: prices, period: 14 });
    const lastRSI = rsi[rsi.length - 1];

    let decision = "";
    if (lastRSI < 30) decision = "BUY (RSI Oversold)";
    else if (lastRSI > 70) decision = "SELL (RSI Overbought)";
    else {
      const ema9 = technicalindicators.EMA.calculate({ values: prices, period: 9 });
      const ema21 = technicalindicators.EMA.calculate({ values: prices, period: 21 });

      const lastEMA9 = ema9[ema9.length - 1];
      const lastEMA21 = ema21[ema21.length - 1];

      decision = lastEMA9 > lastEMA21 ? "BUY (EMA Crossover)" : "SELL (EMA Crossover)";
    }

    // 5️⃣ Return signal
    return {
      asset: "EUR/USD", // default asset for now
      decision,
      time: new Date().toLocaleTimeString(),
    };

  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err);
    return null;
  } finally {
    await browser.close();
  }
}