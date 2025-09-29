// pocketscraper.js
import puppeteer from "puppeteer";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

let browser = null;
let page = null;

/* ---------- Helpers ---------- */
async function initBrowser() {
  if (browser && page) return { browser, page };

  console.log("🌐 Launching Puppeteer (persistent session)...");
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

  browser = await puppeteer.launch(launchOptions);
  page = await browser.newPage();
  page.setDefaultTimeout(25000);

  console.log("🔑 Logging into Pocket Option...");
  await page.goto("https://pocketoption.com/en/login/", {
    waitUntil: "networkidle2",
  });

  await page.type('input[name="email"], input[type="email"]', EMAIL, {
    delay: 50,
  });
  await page.type('input[name="password"], input[type="password"]', PASSWORD, {
    delay: 50,
  });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
  ]);

  console.log("✅ Login successful and session ready");
  return { browser, page };
}

async function saveShot(label = "debug") {
  const ts = Date.now();
  const fname = `${label}-${ts}.png`;
  try {
    if (page) {
      await page.screenshot({ path: fname, fullPage: true });
      console.log(`📸 Screenshot saved: ${fname}`);
    }
  } catch (err) {
    console.warn("⚠️ Screenshot failed:", err.message);
  }
}

function parseTextForSignals(text, limit = 10) {
  if (!text) return [];

  console.log("📝 First 200 chars of text:", text.slice(0, 200));

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-300);

  const signals = [];
  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];

    let decision = null;
    if (/up|call|buy|⬆️/i.test(line)) decision = "⬆️ UP";
    if (/down|put|sell|⬇️/i.test(line)) decision = "⬇️ DOWN";

    if (decision) {
      const strength = /strong|🔥|alert/i.test(line) ? "Strong" : "Normal";
      signals.push({
        asset: "UNKNOWN",
        decision,
        strength,
        raw: line,
      });
    }
  }

  console.log(`📢 Parsed ${signals.length} signals`);
  return signals;
}

/* ---------- Public Functions ---------- */

// Scrape live chat signals without re-login
export async function getPocketSignals(limit = 5) {
  try {
    await initBrowser();

    console.log("📥 Extracting signals...");
    const text = await page.evaluate(() => document.body.innerText || "");
    const parsed = parseTextForSignals(text, limit);

    return parsed;
  } catch (err) {
    console.error("❌ getPocketSignals error:", err.message);
    return [];
  }
}

// Scrape raw text without re-login
export async function getPocketData() {
  try {
    await initBrowser();

    console.log("📥 Extracting raw text...");
    const text = await page.evaluate(() => document.body.innerText || "");
    console.log("📝 Raw text length:", text.length);

    return text;
  } catch (err) {
    console.error("❌ getPocketData error:", err.message);
    return "";
  }
}

/* Graceful shutdown */
export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
      console.log("👋 Browser closed manually");
    } catch {}
    browser = null;
    page = null;
  }
}