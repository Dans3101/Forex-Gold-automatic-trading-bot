// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null; // ⏱️ scraper timer

/* ---------- Utility: Safe Telegram Send ---------- */
export async function sendTelegramMessage(bot, text, chatId = telegramChatId) {
  if (!chatId) {
    console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send:", text);
    return;
  }
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    console.log("📤 Sent to Telegram:", text);
  } catch (err) {
    console.error("❌ Telegram send failed:", err.message);
  }
}

/* ---------- Run One Scraper Cycle ---------- */
async function runScraper(bot) {
  try {
    console.log("🔍 Running combined scraper...");

    // 1️⃣ Market Data
    const data = await getPocketData();
    console.log("📊 Market Data:", data);

    if (data.length > 0) {
      for (const d of data) {
        const msg = `📊 *Market Data*\nAsset: *${d.asset}*\nDecision: *${d.decision}*`;
        await sendTelegramMessage(bot, msg);
      }
    } else {
      console.log("ℹ️ No market data this cycle.");
    }

    // 2️⃣ Live Chat Signals
    const signals = await getPocketSignals(5);
    console.log("📢 Chat Signals:", signals);

    if (signals.length > 0) {
      for (const sig of signals) {
        const msg = `📢 *Chat Signal* (${sig.strength})\nAsset: *${sig.asset}*\nDecision: *${sig.decision}*\n📝 Raw: ${sig.raw}`;
        await sendTelegramMessage(bot, msg);
      }
    } else {
      console.log("ℹ️ No signals extracted this cycle.");
    }

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
      await sendTelegramMessage(
        bot,
        `👋 Hello! Your Chat ID is: \`${chatId}\`\n\nSave this ID in your .env as *TELEGRAM_CHAT_ID* to receive signals here.`,
        chatId
      );
    }

    // ✅ /id command
    if (text === "/id") {
      await sendTelegramMessage(bot, `🆔 Your Chat ID is: \`${chatId}\``, chatId);
      return;
    }

    // ✅ Restrict unauthorized users
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      await sendTelegramMessage(bot, "⚠️ You are not authorized to control signals.", chatId);
      return;
    }

    /* ---------- Commands ---------- */
    if (text === ".on") {
      if (!isBotOn) {
        isBotOn = true;
        console.log("✅ Bot turned ON, starting scraper...");
        await sendTelegramMessage(
          bot,
          `✅ Signal forwarding *enabled*!\n\n⏳ Fetching PocketOption signals every *${signalIntervalMinutes} minutes*.\n- 📊 Market Data\n- 📢 Live Chat Signals`,
          chatId
        );

        // Run immediately & start interval
        runScraper(bot);
        scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
      } else {
        await sendTelegramMessage(bot, "⚠️ Bot is already ON.", chatId);
      }
    } else if (text === ".off") {
      if (isBotOn) {
        isBotOn = false;
        console.log("⛔ Bot turned OFF, stopping scraper...");
        await sendTelegramMessage(bot, "⛔ Signal forwarding *disabled*.", chatId);

        if (scraperInterval) {
          clearInterval(scraperInterval);
          scraperInterval = null;
        }
      } else {
        await sendTelegramMessage(bot, "⚠️ Bot is already OFF.", chatId);
      }
    } else {
      console.log("🤖 Bot received other message:", msg.text);
      await sendTelegramMessage(bot, `🤖 I received your message: "${msg.text}"`, chatId);
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