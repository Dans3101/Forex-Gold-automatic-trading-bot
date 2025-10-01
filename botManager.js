import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData } from "./pocketscraper.js"; // 🚨 removed getPocketSignals

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
let scraperRunning = false;
const knownChats = new Set();
let scraperInterval = null;
let firstRun = true;

/* ---------- Safe Telegram Send ---------- */
export async function sendTelegramMessage(bot, text) {
  if (!telegramChatId) return console.warn("⚠️ TELEGRAM_CHAT_ID missing:", text);
  try {
    await bot.sendMessage(telegramChatId, text, { parse_mode: "Markdown" });
    console.log("📤 Sent to Telegram:", text);
  } catch (err) {
    console.error("❌ Telegram send failed:", err.message);
  }
}

/* ---------- Delay Helper ---------- */
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/* ---------- Scraper Wrapper with Retry ---------- */
async function fetchWithRetry(bot, fetchFunction, type) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchFunction();
      if (attempt > 1) await sendTelegramMessage(bot, `✅ ${type} succeeded on retry #${attempt}`);
      return result;
    } catch (err) {
      console.error(`❌ ${type} failed (attempt #${attempt}):`, err.message);
      await sendTelegramMessage(bot, `🔁 ${type} failed attempt #${attempt}. Retrying...`);
      if (attempt === maxRetries) {
        await sendTelegramMessage(bot, `❌ ${type} failed after ${maxRetries} retries. Check logs.`);
        return [];
      }
    }
  }
}

/* ---------- Run One Scraper Cycle ---------- */
async function runScraper(bot) {
  if (scraperRunning) {
    console.log("⏳ Scraper already running, skipping...");
    return;
  }

  scraperRunning = true;
  try {
    console.log("🔍 Running market data scraper...");

    // --- Market Data ---
    const data = await fetchWithRetry(bot, getPocketData, "Market Data");
    if (data.length === 0) {
      console.log("ℹ️ No market data this cycle.");
      if (!firstRun) await sendTelegramMessage(bot, "ℹ️ No market data this cycle.");
    } else {
      console.log("📊 Market Data:", data);
      for (const d of data) {
        await sendTelegramMessage(bot, `📊 *Market Data*\nAsset: *${d.asset}*\nDecision: *${d.decision}*`);
        await delay(30000);
      }
    }

    console.log("✅ Scraper cycle complete.");
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    await sendTelegramMessage(bot, `⚠️ Error fetching market data: ${err.message}`);
  } finally {
    scraperRunning = false;
    firstRun = false;
  }
}

/* ---------- Start Bot ---------- */
export function startBot(bot) {
  if (!bot) return console.error("❌ No bot instance passed into startBot()");

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();
    console.log(`💬 Message from ${chatId}: ${text}`);

    // --- Auto-send Chat ID ---
    if (!knownChats.has(chatId)) {
      knownChats.add(chatId);
      await bot.sendMessage(
        chatId,
        `👋 Hello! Your Chat ID is: \`${chatId}\`\nSave this ID in your .env as *TELEGRAM_CHAT_ID* to receive signals.`,
        { parse_mode: "Markdown" }
      );
    }

    // --- /id command ---
    if (text === "/id") return bot.sendMessage(chatId, `🆔 Your Chat ID: \`${chatId}\``, { parse_mode: "Markdown" });

    // --- Restrict unauthorized ---
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      return bot.sendMessage(chatId, "⚠️ You are not authorized to control this bot.");
    }

    // --- Commands ---
    if (text === ".on" && !isBotOn) {
      isBotOn = true;
      console.log("✅ Bot ON, starting scraper...");
      await bot.sendMessage(
        chatId,
        `✅ Signal forwarding enabled!\nFetching market data every *${signalIntervalMinutes} minutes*`,
        { parse_mode: "Markdown" }
      );
      runScraper(bot);
      scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
    } else if (text === ".off" && isBotOn) {
      isBotOn = false;
      console.log("⛔ Bot OFF, stopping scraper...");
      await bot.sendMessage(chatId, "⛔ Signal forwarding disabled.");
      if (scraperInterval) {
        clearInterval(scraperInterval);
        scraperInterval = null;
      }
    } else if (text !== ".on" && text !== ".off") {
      await bot.sendMessage(chatId, `🤖 I received: "${msg.text}"`);
    }
  });

  // --- Auto-start scraper on deploy ---
  if (!isBotOn) {
    isBotOn = true;
    console.log("⚡ Auto-start scraper after deploy...");
    runScraper(bot);
    scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
  }

  return { isBotOn: () => isBotOn };
}