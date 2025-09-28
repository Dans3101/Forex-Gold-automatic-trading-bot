// pocketscraper.js
import puppeteer from "puppeteer";

/**
 * Pocket Option scraper helpers.
 *
 * Exports:
 *  - getPocketData()    -> returns a small array [{ asset, decision }] (random asset decision)
 *  - getPocketSignals() -> returns array of detected signals from live chat [{ asset, decision, strength }]
 *
 * NOTES:
 *  - You must set environment variables POCKET_EMAIL and POCKET_PASSWORD to log in.
 *  - If Render/your host does not have Chrome/Chromium, set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH
 *    to the system chrome binary path (e.g. /usr/bin/google-chrome-stable).
 *  - If Chromium isn't available you'll get a helpful error message in the logs.
 */

/* --- Environment / config --- */
const EMAIL = process.env.POCKET_EMAIL;
const PASSWORD = process.env.POCKET_PASSWORD;

/* Puppeteer launch helper with helpful errors */
async function launchBrowser() {
  const execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    (typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined);

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
  }

  try {
    return await puppeteer.launch(launchOptions);
  } catch (err) {
    // Re-throw with clearer instructions
    const msg =
      (err && err.message) ||
      String(err) ||
      "Unknown error launching puppeteer/chrome";
    const informative = [
      "Could not launch Chrome/Chromium for Puppeteer.",
      `Error: ${msg}`,
      "If you are running this on Render / a container make sure one of the following is true:",
      "  • Use a Puppeteer package that bundles Chromium (install puppeteer) and allow postinstall to download the binary",
      "  • Or set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH to a valid Chrome/Chromium binary path available in the container.",
      "Example (Render environment variable): PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable",
      "If you want to force a local test, install Chromium locally or run `npx puppeteer install`.",
    ].join("\n");
    const e = new Error(informative);
    e.original = err;
    throw e;
  }
}

/* Utility: parse page text to find signal-like lines */
function parseTextForSignals(text, limit = 10) {
  if (!text) return [];

  // Normalize
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-200); // last 200 lines only (avoid huge pages)

  const signals = [];
  const decisionRE = /\b(BUY|SELL|CALL|PUT|UP|DOWN|LONG|SHORT)\b/i;
  const strongRE = /\b(STRONG|STRONG BUY|STRONG SELL|STRONG CALL|STRONG PUT|STRONG SIGNAL|STRONG BUY SIGNAL)\b/i;
  const assetREs = [
    /\b([A-Z]{3}\/[A-Z]{3})\b/g, // EUR/USD style
    /\b([A-Z]{6})\b/g, // EURUSD USDJPY back-to-back 6-letter
    /\b([A-Z]{3,5}-[A-Z]{3,5})\b/g, // BTC-USD etc
  ];

  // scan lines from newest to oldest
  for (let i = lines.length - 1; i >= 0 && signals.length < limit; i--) {
    const line = lines[i];
    if (!decisionRE.test(line)) continue;

    // detect decision
    const dmatch = (line.match(decisionRE) || [null])[0];
    const decision = dmatch ? dmatch.toUpperCase() : null;

    // detect strength
    const strongMatch = strongRE.test(line) ? "Strong" : null;

    // try to find asset in same line or nearby lines
    let asset = null;
    for (const r of assetREs) {
      const m = [...line.matchAll(r)];
      if (m && m.length > 0) {
        asset = m[0][1];
        break;
      }
    }
    // if not found, look forward/back a few lines
    if (!asset) {
      for (let j = i - 1; j >= Math.max(0, i - 4) && !asset; j--) {
        const l2 = lines[j];
        for (const r of assetREs) {
          const m2 = [...l2.matchAll(r)];
          if (m2 && m2.length > 0) {
            asset = m2[0][1];
            break;
          }
        }
      }
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4) && !asset; j++) {
        const l2 = lines[j];
        for (const r of assetREs) {
          const m2 = [...l2.matchAll(r)];
          if (m2 && m2.length > 0) {
            asset = m2[0][1];
            break;
          }
        }
      }
    }

    // if we at least have decision, push candidate
    if (decision) {
      signals.push({
        asset: asset || "UNKNOWN",
        decision,
        strength: strongMatch || "Normal",
        raw: line,
      });
    }
  }

  return signals;
}

/**
 * getPocketData()
 * Simple function used previously: returns one random asset with random BUY/SELL.
 * If you want real signals use getPocketSignals()
 */
export async function getPocketData() {
  // quick fallback: if credentials missing, return empty and log
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ POCKET_EMAIL / POCKET_PASSWORD not set - getPocketData will not login.");
    // Provide a simulated random asset (but you asked for real signals -- empty is safer)
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    // attempt to login using common selectors
    try {
      await page.type('input[name="email"]', EMAIL, { delay: 80 });
      await page.type('input[name="password"]', PASSWORD, { delay: 80 });
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
      ]);
    } catch (loginErr) {
      console.warn("⚠️ Could not log in using default selectors. Trying fallback selectors...");
      // fallback attempts
      try {
        await page.type('input[type="email"]', EMAIL, { delay: 80 });
        await page.type('input[type="password"]', PASSWORD, { delay: 80 });
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        ]);
      } catch (err) {
        console.error("❌ Login failed:", (err && err.message) || err);
        return [];
      }
    }

    // wait for assets list; try different selectors
    const assetSelectors = [".asset-title", ".symbols-list", ".trading-pair", ".asset-name"];
    let assets = [];
    for (const sel of assetSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        assets = await page.$$eval(sel, (nodes) => nodes.map((n) => (n.innerText || n.textContent).trim()).filter(Boolean));
        if (assets && assets.length > 0) break;
      } catch (e) {
        // ignore and try next selector
      }
    }

    // If still nothing, try scraping visible text and parse assets heuristically
    if (!assets || assets.length === 0) {
      const pageText = await page.evaluate(() => document.body.innerText || "");
      const possible = [];
      const assetRE = /\b([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|[A-Z]{3,5}-[A-Z]{3,5})\b/g;
      for (const m of pageText.matchAll(assetRE)) possible.push(m[1]);
      assets = [...new Set(possible)].slice(0, 200);
    }

    if (!assets || assets.length === 0) {
      console.warn("⚠️ No assets discovered on dashboard.");
      return [];
    }

    const selectedAsset = assets[Math.floor(Math.random() * assets.length)];
    const decision = Math.random() > 0.5 ? "BUY" : "SELL";

    return [{ asset: selectedAsset, decision }];
  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err && (err.message || err.toString()));
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

/**
 * getPocketSignals()
 * Attempts to read a Pocket Option "live chat" or dashboard and return signal candidate lines.
 * Returns array: [{ asset, decision, strength, raw }]
 */
export async function getPocketSignals({ onlyStrong = false, limit = 5 } = {}) {
  if (!EMAIL || !PASSWORD) {
    console.warn("⚠️ POCKET_EMAIL / POCKET_PASSWORD not set - getPocketSignals will not login.");
    return [];
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    // go to the page that usually contains live chat / signals
    // NOTE: the specific path may change with Pocket Option UI; try login then dashboard
    await page.goto("https://pocketoption.com/en/login/", { waitUntil: "networkidle2" });

    // Login similar to getPocketData
    try {
      await page.type('input[name="email"]', EMAIL, { delay: 80 });
      await page.type('input[name="password"]', PASSWORD, { delay: 80 });
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
      ]);
    } catch (loginErr) {
      console.warn("⚠️ Login fallback attempt...");
      try {
        await page.type('input[type="email"]', EMAIL, { delay: 80 });
        await page.type('input[type="password"]', PASSWORD, { delay: 80 });
        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }),
        ]);
      } catch (err) {
        console.error("❌ Login failed:", (err && err.message) || err);
        return [];
      }
    }

    // Attempt to find live-chat messages using several candidate selectors
    const chatSelectors = [
      ".chat-messages",
      ".live-chat",
      ".chatList",
      ".messages",
      ".channel__messages",
      ".chat-window__messages",
      ".message",
      ".chat__message",
    ];

    let pageText = "";
    for (const sel of chatSelectors) {
      try {
        const exists = await page.$(sel);
        if (exists) {
          pageText = await page.$eval(sel, (el) => el.innerText || el.textContent || "");
          if (pageText && pageText.trim().length > 10) break;
        }
      } catch (_) {
        // ignore and continue
      }
    }

    // If no chat snippet, fallback to full page text
    if (!pageText || pageText.trim().length < 10) {
      pageText = await page.evaluate(() => (document.body && (document.body.innerText || document.body.textContent)) || "");
    }

    if (!pageText || pageText.trim().length === 0) {
      console.warn("⚠️ Could not extract text from page for signal parsing.");
      return [];
    }

    // Parse for signals
    const parsed = parseTextForSignals(pageText, 50);
    if (parsed.length === 0) {
      return [];
    }

    // Optionally filter for strong signals
    const strongLower = parsed.filter((s) => /strong/i.test(s.strength));
    const results = onlyStrong ? strongLower.slice(0, limit) : parsed.slice(0, limit);

    return results;
  } catch (err) {
    console.error("❌ Error scraping Pocket Option:", err && (err.message || err.toString()));
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}