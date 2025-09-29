// pocketscraper.js
import puppeteer from "puppeteer";
import fs from "fs";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

/* ---------- Helpers ---------- */
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

  console.log("🌐 Launching Puppeteer...");
  if (execPath) console.log("🔍 Using Chrome path:", execPath);

  try {
    const browser = await puppeteer.launch(launchOptions);
    console.log("✅ Puppeteer browser launched successfully");
    return browser;
  } catch (err) {
    console.error("❌ Puppeteer failed to launch:", err.message);
    throw err; // rethrow so main function logs it too
  }
}

/* Save screenshot for debugging */
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

/* Parse chat text for UP/DOWN signals */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];

  console.log("📝 RAW chat text (first 300 chars):", text.slice(0, 300));

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-300); // last ~300 lines

  const signals = [];
  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];

    let decision = null;
    if (/up|call|buy|⬆️/i.test(line)) decision = "⬆️ UP";
    if (/down|put|sell|⬇️/i.test(line)) decision = "⬇️ DOWN";

    if (decision) {
      const strength = /strong/i.test(line) ? "Strong" : "Normal";
      signals.push({
        asset: "UNKNOWN", // simplify first
        decision,
        strength,
        raw: line,
      });
    }
  }
  return signals;
}

/* ---------- Main Function ---------- */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    console.log("🔑 Logging into Pocket Option...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
    ]);
    console.log("✅ Login successful");

    // Screenshot for debugging
    await saveShot(page, "debug-chat");

    // Extract all visible text
    console.log("📥 Extracting page text...");
    let text = await page.evaluate(() => document.body.innerText || "");
    const parsed = parseTextForSignals(text, limit);

    console.log(`✅ Extracted ${parsed.length} signals`);
    return parsed;
  } catch (err) {
    console.error("❌ getPocketSignals error:", err.message);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      console.log("👋 Puppeteer browser closed");
    }
  }
}