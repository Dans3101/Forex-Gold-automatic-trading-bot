// pocketscraper.js
import puppeteer from "puppeteer";

// ✅ Use environment variables for safety (Render friendly)
const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

export async function getPocketData() {
  // Launch Puppeteer with Render-safe flags
  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();

  try {
    // Go to Pocket Option login page
    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // Fill login form
    await page.type('input[name="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"]', PASSWORD, { delay: 80 });
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Wait for assets list (adjust selector if Pocket changes layout)
    await page.waitForSelector(".asset-title", { timeout: 20000 });

    // Scrape all available assets
    const assets = await page.$$eval(".asset-title", (nodes) =>
      nodes.map((n) => n.innerText.trim())
    );

    if (!assets || assets.length === 0) {
      throw new Error("No assets found.");
    }

    // Pick a random asset
    const randomIndex = Math.floor(Math.random() * assets.length);
    const selectedAsset = assets[randomIndex];

    // Wait 30 seconds before making decision
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Random BUY or SELL decision
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