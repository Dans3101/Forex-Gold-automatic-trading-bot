import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
let scraperRunning = false; // ⏳ prevent overlapping scraper runs
const knownChats = new Set();
let scraperInterval = null;

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

/* ---------- Run One Scraper Cycle ---------- */
async function runScraper(bot) {
  if (scraperRunning) {
    console.log("⏳ Scraper is already running, skipping this cycle...");
    return;
  }

  scraperRunning = true;
  try {
    console.log("🔍 Running combined scraper...");

    // --- Market Data ---
    const data = await getPocketData();
    console.log("📊 Market Data:", data);
    for (const d of data) {
      await sendTelegramMessage(bot, `📊 *Market Data*\nAsset: *${d.asset}*\nDecision: *${d.decision}*`);
    }
    if (data.length === 0) console.log("ℹ️ No market data this cycle.");

    // --- Chat Signals ---
    const signals = await getPocketSignals(5);
    console.log("📢 Chat Signals:", signals);
    for (const sig of signals) {
      await sendTelegramMessage(
        bot,
        `📢 *Chat Signal* (${sig.strength})\nAsset: *${sig.asset}*\nDecision: *${sig.decision}*\n📝 Raw: ${sig.raw}`
      );
    }
    if (signals.length === 0) console.log("ℹ️ No signals extracted this cycle.");

    console.log("✅ Scraper cycle complete.");
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    await sendTelegramMessage(bot, "⚠️ Error fetching signals. Check logs.");
  } finally {
    scraperRunning = false;
  }
}

/* ---------- Start Bot ---------- */
export function startBot(bot) {
  if (!bot) return console.error("❌ No bot instance passed into startBot()");

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();
    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

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
    if (text === "/id") return bot.sendMessage(chatId, `🆔 Your Chat ID is: \`${chatId}\``, { parse_mode: "Markdown" });

    // --- Restrict unauthorized users ---
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      return bot.sendMessage(chatId, "⚠️ You are not authorized to control signals.");
    }

    // --- Commands ---
    if (text === ".on" && !isBotOn) {
      isBotOn = true;
      console.log("✅ Bot turned ON, starting scraper...");
      await bot.sendMessage(
        chatId,
        `✅ Signal forwarding enabled! Fetching every *${signalIntervalMinutes} minutes*.\n- 📊 Market Data\n- 📢 Live Chat Signals`,
        { parse_mode: "Markdown" }
      );
      runScraper(bot);
      scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
    } else if (text === ".off" && isBotOn) {
      isBotOn = false;
      console.log("⛔ Bot turned OFF, stopping scraper...");
      await bot.sendMessage(chatId, "⛔ Signal forwarding disabled.");
      if (scraperInterval) {
        clearInterval(scraperInterval);
        scraperInterval = null;
      }
    } else if (text !== ".on" && text !== ".off") {
      await bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}"`);
    }
  });

  // --- Auto-start scraper on deploy ---
  if (!isBotOn) {
    isBotOn = true;
    console.log("⚡ Auto-starting scraper after deploy...");
    runScraper(bot);
    scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
  }

  return { isBotOn: () => isBotOn };
}