// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketData, getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null; // ⏱️ scraper timer

// ✅ Utility: Send message safely
export async function sendTelegramMessage(bot, text) {
  if (!telegramChatId) {
    console.warn("⚠️ TELEGRAM_CHAT_ID missing, cannot send message:", text);
    return;
  }
  try {
    await bot.sendMessage(telegramChatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Failed to send Telegram message:", err.message);
  }
}

// ✅ Run one scrape cycle
async function runScraper(bot) {
  try {
    console.log("🔍 Running combined scraper...");

    // 1. Market Data
    const data = await getPocketData();
    if (data.length > 0) {
      for (const d of data) {
        await sendTelegramMessage(
          bot,
          `📊 *Market Data*\nAsset: *${d.asset}*\nDecision: *${d.decision}*`
        );
      }
    } else {
      console.log("ℹ️ No market data this cycle.");
    }

    // 2. Live Chat Signals
    const signals = await getPocketSignals(5);
    if (signals.length > 0) {
      for (const sig of signals) {
        await sendTelegramMessage(
          bot,
          `📢 *Chat Signal* (${sig.strength})\nAsset: *${sig.asset}*\nDecision: *${sig.decision}*\n📝 Raw: ${sig.raw}`
        );
      }
    } else {
      console.log("ℹ️ No signals extracted this cycle.");
    }
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    await sendTelegramMessage(bot, "⚠️ Error fetching signals. Check logs.");
  }
}

// ✅ Main bot entry
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    // ✅ Auto-send chat ID for new users
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
      await bot.sendMessage(chatId, `🆔 Your Chat ID is: \`${chatId}\``, {
        parse_mode: "Markdown",
      });
      return;
    }

    // ✅ Restrict control if chat not authorized
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      await bot.sendMessage(chatId, "⚠️ You are not authorized to control signals.");
      return;
    }

    // --- Commands ---
    if (text === ".on") {
      if (!isBotOn) {
        isBotOn = true;
        await bot.sendMessage(
          chatId,
          `✅ Signal forwarding *enabled*!\n\n⏳ Fetching PocketOption signals every *${signalIntervalMinutes} minutes*.\n\nWill send both:\n- 📊 Market Data\n- 📢 Live Chat Signals`,
          { parse_mode: "Markdown" }
        );

        // 🔥 Run immediately once
        runScraper(bot);

        // Then keep running on interval
        scraperInterval = setInterval(() => runScraper(bot), signalIntervalMinutes * 60 * 1000);
      } else {
        await bot.sendMessage(chatId, "⚠️ Bot is already ON.");
      }
    }

    else if (text === ".off") {
      if (isBotOn) {
        isBotOn = false;
        await bot.sendMessage(chatId, "⛔ Signal forwarding *disabled*.");

        if (scraperInterval) {
          clearInterval(scraperInterval);
          scraperInterval = null;
        }
      } else {
        await bot.sendMessage(chatId, "⚠️ Bot is already OFF.");
      }
    }

    else {
      await bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}"`);
    }
  });

  return {
    isBotOn: () => isBotOn,
  };
}