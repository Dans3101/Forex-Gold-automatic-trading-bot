// pocketscraper.js
import puppeteer from "puppeteer";

// ✅ Pocket Option credentials from environment variables (Render Dashboard → Environment)
const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

export async function getPocketSignals() {
  let browser;

  try {
    // 🚀 Launch Puppeteer with Render-safe configuration
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // <- good for small containers
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    console.log("🌐 Navigating to Pocket Option login...");

    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // 📝 Login to Pocket Option
    await page.type('input[name="email"]', EMAIL, { delay: 100 });
    await page.type('input[name="password"]', PASSWORD, { delay: 100 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    console.log("🔑 Logged in successfully. Loading dashboard...");

    // 🎯 Wait for asset list to be ready (adjust selector if the UI changes)
    await page.waitForSelector(".asset-title", { timeout: 20000 });

    // Scrape all available assets
    const assets = await page.$$eval(".asset-title", (nodes) =>
      nodes.map((n) => n.innerText.trim())
    );

    if (!assets || assets.length === 0) {
      throw new Error("No assets found on dashboard.");
    }

    console.log(`✅ Found ${assets.length} assets.`);

    // 🎲 Pick a random asset from the list
    const selectedAsset = assets[Math.floor(Math.random() * assets.length)];

    // 🤖 Add human-like delay before decision (5–15 seconds)
    const delayMs = 5000 + Math.floor(Math.random() * 10000);
    console.log(`⏳ Waiting ${delayMs / 1000}s before making a decision...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // 📌 Randomly choose BUY or SELL decision
    const decision = Math.random() > 0.5 ? "BUY" : "SELL";

    console.log(`📊 Signal -> Asset: ${selectedAsset}, Decision: ${decision}`);

    return [
      {
        asset: selectedAsset,
        decision,
      },
    ];
  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
      console.log("🛑 Browser closed.");
    }
  }
}