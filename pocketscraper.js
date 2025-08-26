import puppeteer from "puppeteer";

export async function getMarketData(email, password) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Open Pocket Option login
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // 2. Login
    await page.type('input[name="email"]', email, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // 3. Go to EUR/USD chart
    await page.goto("https://pocketoption.com/en/trading/?asset=eurusd", {
      waitUntil: "networkidle2",
    });

    // 4. Extract candle data (last 50 prices)
    const prices = await page.evaluate(() => {
      const candles = Array.from(
        document.querySelectorAll(".chart-canvas .tv-candle")
      );
      return candles.slice(-50).map(c => parseFloat(c.getAttribute("data-close")));
    });

    return prices;
  } catch (err) {
    console.error("❌ Scraping error:", err);
    return [];
  } finally {
    await browser.close();
  }
}