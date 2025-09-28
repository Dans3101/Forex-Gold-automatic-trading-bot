// pocketscraper.js
import puppeteer from "puppeteer";

// ✅ Pocket Option credentials from environment variables
const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

export async function getPocketSignals() {
  let browser;

  try {
    console.log("🔍 Launching scraper...");

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
    page.setDefaultTimeout(25000);

    console.log("🌐 Navigating to Pocket Option login...");

    await page.goto("https://pocketoption.com/en/login/", {
      waitUntil: "networkidle2",
    });

    // 📝 Login
    await page.type('input[name="email"]', EMAIL, { delay: 100 });
    await page.type('input[name="password"]', PASSWORD, { delay: 100 });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    console.log("🔑 Logged in successfully. Loading dashboard...");

    // 🎯 Wait for signal section (social trading / traders choice)
    await page.waitForSelector(".signals, .traders-choices", {
      timeout: 30000,
    });

    // 📌 Extract signals
    const signals = await page.$$eval(
      ".signals .signal-item, .traders-choices .choice-item",
      (nodes) =>
        nodes.map((n) => {
          const asset =
            n.querySelector(".asset-title")?.innerText?.trim() ||
            n.querySelector(".asset")?.innerText?.trim() ||
            "Unknown Asset";

          const direction =
            n.querySelector(".buy")?.innerText?.trim() ||
            n.querySelector(".sell")?.innerText?.trim() ||
            n.querySelector(".direction")?.innerText?.trim();

          const percentText =
            n.querySelector(".percent")?.innerText?.trim() || "";

          const percent = percentText.replace("%", "").trim();

          return {
            asset,
            decision: direction ? direction.toUpperCase() : null,
            strength: percent ? parseInt(percent, 10) : null,
            raw: n.innerText.trim(),
          };
        })
    );

    // 🎯 Filter strong signals only (≥70%)
    const strongSignals = signals.filter(
      (s) => s.decision && s.strength && s.strength >= 70
    );

    if (!strongSignals.length) {
      console.log("⚠️ No strong signals found.");
      return [];
    }

    console.log(`📊 Found ${strongSignals.length} strong signals:`);
    console.log(strongSignals);

    // Return last 1–2 strong signals
    return strongSignals.slice(-2);
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