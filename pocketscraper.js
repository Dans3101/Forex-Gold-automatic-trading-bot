// pocketscraper.js
import puppeteer from "puppeteer";
import fs from "fs";
import { execSync } from "child_process";

const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

/* ---------- Helpers ---------- */
async function launchBrowserWithFallback() {
  // allow user to force a specific chrome path
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

  if (execPath) {
    launchOptions.executablePath = execPath;
    console.log("🔍 Using provided Chrome executablePath:", execPath);
  } else {
    console.log("🔍 No explicit executablePath provided; relying on Puppeteer default/bundled Chromium.");
  }

  // try launch
  try {
    const browser = await puppeteer.launch(launchOptions);
    console.log("✅ Puppeteer launched browser successfully");
    return browser;
  } catch (err) {
    console.error("❌ Initial puppeteer.launch() failed:", err && err.message ? err.message : err);

    // If execPath was provided, no point trying to download — rethrow and instruct user.
    if (execPath) {
      throw new Error(
        `Could not launch Chrome at provided executablePath (${execPath}). Original error: ${err.message}`
      );
    }

    // Attempt runtime download of Chromium using npx (fallback)
    try {
      console.log("🛠️ Attempting to download Chromium at runtime via `npx puppeteer install` (this may take a while)...");
      // run with a longer timeout - synchronous so logs appear in deploy output
      execSync("npx puppeteer install --unsafe-perm", {
        stdio: "inherit",
        timeout: 20 * 60 * 1000, // 20 minutes
      });
      console.log("✅ Chromium download attempt finished — retrying puppeteer.launch() ...");

      // Retry launching Puppeteer after install
      const browser = await puppeteer.launch(launchOptions);
      console.log("✅ Puppeteer launched browser successfully after runtime install");
      return browser;
    } catch (err2) {
      console.error("❌ Runtime Chromium install or second launch failed:", err2 && err2.message ? err2.message : err2);
      throw new Error(
        "Unable to start Chromium. Two attempts failed (initial launch and runtime install). " +
          "Options:\n" +
          " - Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH to a Chrome/Chromium binary available in the container.\n" +
          " - Deploy using a Docker image that has Chrome installed (see README/Docker example).\n" +
          "Original error: " + (err2.message || err2)
      );
    }
  }
}

/* Save screenshot for debugging */
async function saveShot(page, label = "debug") {
  try {
    const ts = Date.now();
    const fname = `${label}-${ts}.png`;
    await page.screenshot({ path: fname, fullPage: true });
    console.log(`📸 Saved screenshot: ${fname}`);
  } catch (err) {
    console.warn("⚠️ Could not save screenshot:", err && err.message ? err.message : err);
  }
}

/* Parse chat text for UP/DOWN signals */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];

  console.log("📝 RAW chat text preview:", text.slice(0, 500).replace(/\s+/g, " ").slice(0, 400));

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
      const strength = /strong/i.test(line) ? "Strong" : "Normal";
      signals.push({
        asset: "UNKNOWN",
        decision,
        strength,
        raw: line,
      });
    }
  }
  return signals;
}

/* ---------- Public Functions ---------- */

/**
 * getPocketSignals(limit)
 * Logs in to PocketOption, captures debug screenshots, extracts page text
 * and returns parsed UP/DOWN signals from visible text.
 */
export async function getPocketSignals(limit = 5) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - getPocketSignals will not run.");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowserWithFallback();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    console.log("🔑 Navigating to Pocket Option login page...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    console.log("🔐 Filling login form...");
    try {
      await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
      await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
      ]);
      console.log("✅ Login succeeded (navigation complete).");
    } catch (loginErr) {
      console.warn("⚠️ Login attempt failed using default selectors. Capturing screenshot and page text for debugging.");
      await saveShot(page, "debug-login-failed");
      const bodyText = await page.evaluate(() => document.body && (document.body.innerText || ""));
      console.log("📝 Body text preview after failed login:", (bodyText || "").slice(0, 500).replace(/\s+/g," ").slice(0,400));
      throw loginErr;
    }

    // take screenshot of the dashboard / chat area for debugging
    await saveShot(page, "debug-dashboard");

    console.log("📥 Extracting page text for signal parsing...");
    const text = await page.evaluate(() => document.body && (document.body.innerText || ""));
    const parsed = parseTextForSignals(text, limit);

    console.log(`✅ Parsed ${parsed.length} signals from page text.`);
    return parsed;
  } catch (err) {
    console.error("❌ getPocketSignals error:", err && (err.message || err));
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("👋 Puppeteer browser closed");
      } catch (_) {}
    }
  }
}

/**
 * getPocketData()
 * Simpler: logs in and returns a small sample array of market-like decisions
 * (keeps same return shape your bot expects).
 */
export async function getPocketData() {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ Missing POCKET_EMAIL / POCKET_PASSWORD - getPocketData will not run.");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowserWithFallback();
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    console.log("🔑 Navigating to Pocket Option login page for market data...");
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    // login (reuse same selectors)
    await page.type('input[name="email"], input[type="email"]', EMAIL, { delay: 80 });
    await page.type('input[name="password"], input[type="password"]', PASSWORD, { delay: 80 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }),
    ]);

    // capture dashboard screenshot
    await saveShot(page, "debug-market");

    // attempt to gather asset strings heuristically
    const pageText = await page.evaluate(() => document.body && (document.body.innerText || ""));
    const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
    const assets = [];
    for (const m of pageText.matchAll(assetRE)) {
      assets.push(m[1]);
      if (assets.length >= 50) break;
    }

    if (!assets.length) {
      console.warn("⚠️ No assets discovered on dashboard text.");
      return [];
    }

    const selected = assets[Math.floor(Math.random() * assets.length)];
    const decision = Math.random() > 0.5 ? "⬆️ BUY" : "⬇️ SELL";

    console.log("📊 getPocketData picked:", { asset: selected, decision });
    return [{ asset: selected, decision }];
  } catch (err) {
    console.error("❌ getPocketData error:", err && (err.message || err));
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("👋 Puppeteer browser closed");
      } catch (_) {}
    }
  }
}