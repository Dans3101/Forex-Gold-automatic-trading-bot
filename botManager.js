// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null; // ⏱️ scraper timer

// ✅ Start Telegram bot
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    // ✅ Send chat ID once for new chats
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

    // ✅ Restrict commands if TELEGRAM_CHAT_ID is set
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
          `✅ Signal forwarding *enabled*!\n\n⏳ I will fetch Pocket Option signals every *${signalIntervalMinutes} minutes* and send only *Strong Signals*.`,
          { parse_mode: "Markdown" }
        );

        // Start Pocket Option scraper ⏱️
        scraperInterval = setInterval(async () => {
          try {
            console.log("🔍 Fetching Pocket Option signals...");
            const signals = await getPocketSignals({ onlyStrong: true, limit: 5 });

            if (signals.length > 0) {
              for (const sig of signals) {
                await bot.sendMessage(
                  telegramChatId,
                  `📊 *Strong Signal*\n\nAsset: *${sig.asset}*\nDecision: *${sig.decision}*`,
                  { parse_mode: "Markdown" }
                );
              }
            } else {
              console.log("ℹ️ No strong signals detected this cycle.");
            }
          } catch (err) {
            console.error("❌ Scraper error:", err.message);
            await bot.sendMessage(
              telegramChatId,
              "⚠️ Error fetching Pocket Option signals. Check logs."
            );
          }
        }, signalIntervalMinutes * 60 * 1000);
      } else {
        await bot.sendMessage(chatId, "⚠️ Bot is already ON.");
      }

    } else if (text === ".off") {
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

    } else {
      await bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}"`);
    }
  });

  return {
    isBotOn: () => isBotOn,
  };
}