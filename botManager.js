// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null; // ⏱️ scraper timer

/* ---------- Utility: Safe Telegram Send ---------- */
export async function sendTelegramMessage(bot, text) {
  if (!telegramChatId) {
    console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send:", text);
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, text, { parse_mode: "Markdown" });
    console.log("📤 Sent to Telegram:", text);
  } catch (err) {
    console.error("❌ Telegram send failed:", err.message);
  }
}

/* ---------- Run One Scraper Cycle ---------- */
async function runScraper(bot) {
  try {
    console.log("🔍 Running combined scraper...");

    // 1. Market Data
    const data = await getPocketData();
    console.log("📊 Market Data:", data);

    for (const d of data) {
      const msg = `📊 *Market Data*\nAsset: *${d.asset}*\nDecision: *${d.decision}*`;
      await sendTelegramMessage(bot, msg);
    }

    if (data.length === 0) console.log("ℹ️ No market data this cycle.");

    // 2. Live Chat Signals
    const signals = await getPocketSignals(5);
    console.log("📢 Chat Signals:", signals);

    for (const sig of signals) {
      const msg = `📢 *Chat Signal* (${sig.strength})\nAsset: *${sig.asset}*\nDecision: *${sig.decision}*\n📝 Raw: ${sig.raw}`;
      await sendTelegramMessage(bot, msg);
    }

    if (signals.length === 0) console.log("ℹ️ No signals extracted this cycle.");

    console.log("✅ Scraper cycle complete.");
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    await sendTelegramMessage(bot, "⚠️ Error fetching signals. Check logs.");
  }
}

/* ---------- Main Bot Entry ---------- */
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    // ✅ Auto-send chat ID to new users
    if (!knownChats.has(chatId)) {
      knownChats.add(chatId);
      await bot.sendMessage(
        chatId,
        `👋 Hello! Your Chat ID is: \`${chatId}\`\n\nSave this ID in your .env as *TELEGRAM_CHAT_ID* to receive signals here.`,
        { parse_mode: "Markdown" }
      );
    }

    // ✅ /id command
    if (text === "/id") {
      await bot.sendMessage(chatId, `🆔 Your Chat ID is: \`${chatId}\``, { parse_mode: "Markdown" });
      return;
    }

    // ✅ Restrict unauthorized users
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      await bot.sendMessage(chatId, "⚠️ You are not authorized to control signals.");
      return;
    }

    /* ---------- Commands ---------- */
    if (text === ".on") {
      if (!isBotOn) {
        isBotOn = true;
        console.log("✅ Bot turned ON, starting scraper...");

        await bot.sendMessage(
          chatId,
          `✅ Signal forwarding *enabled*!\n\n⏳ Fetching PocketOption signals every *${signalIntervalMinutes} minutes*.\n- 📊 Market Data\n- 📢 Live Chat Signals`,
          { parse_mode: "Markdown" }
        );

        runScraper(bot);
        scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
      } else {
        await bot.sendMessage(chatId, "⚠️ Bot is already ON.");
      }
    } else if (text === ".off") {
      if (isBotOn) {
        isBotOn = false;
        console.log("⛔ Bot turned OFF, stopping scraper...");
        await bot.sendMessage(chatId, "⛔ Signal forwarding *disabled*.");

        if (scraperInterval) {
          clearInterval(scraperInterval);
          scraperInterval = null;
        }
      } else {
        await bot.sendMessage(chatId, "⚠️ Bot is already OFF.");
      }
    } else {
      console.log("🤖 Bot received other message:", msg.text);
      await bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}"`);
    }
  });

  /* ---------- Auto-start scraping on deploy ---------- */
  if (!isBotOn) {
    isBotOn = true;
    console.log("⚡ Auto-starting scraper after deploy...");
    runScraper(bot);
    scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
  }

  return { isBotOn: () => isBotOn };
}