// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Target Chat ID from config:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null; // ⏱️ Timer reference

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

    // ✅ Auto-send chat ID once per chat
    if (!knownChats.has(chatId)) {
      knownChats.add(chatId);
      await bot.sendMessage(
        chatId,
        `👋 Hello! Your Chat ID is: \`${chatId}\`\n\nSave this ID in your .env as *TELEGRAM_CHAT_ID* if you want me to send signals here.`,
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
          "✅ Signal forwarding *enabled*! Waiting for Pocket Option signals..."
        );

        // Start Pocket Option scraper ⏱️
        scraperInterval = setInterval(async () => {
          try {
            const signals = await getPocketSignals();

            // ✅ Only forward "STRONG" signals
            const strongSignals = signals.filter(
              (s) => s.strength && s.strength.toLowerCase().includes("strong")
            );

            if (strongSignals.length > 0) {
              for (const sig of strongSignals) {
                await bot.sendMessage(
                  telegramChatId,
                  `📊 *Strong Signal Detected!*\n\n` +
                  `💹 Asset: *${sig.asset}*\n` +
                  `📈 Decision: *${sig.decision}*\n` +
                  `🔥 Strength: ${sig.strength}`,
                  { parse_mode: "Markdown" }
                );
              }
            }
          } catch (err) {
            console.error("❌ Scraper error:", err.message);
            await bot.sendMessage(
              telegramChatId,
              "⚠️ Error fetching Pocket Option signals."
            );
          }
        }, signalIntervalMinutes * 60 * 1000);
      }

    } else if (text === ".off") {
      if (isBotOn) {
        isBotOn = false;
        await bot.sendMessage(chatId, "⛔ Signal forwarding *disabled*.");

        // Stop scraper
        if (scraperInterval) {
          clearInterval(scraperInterval);
          scraperInterval = null;
        }
      }

    } else {
      await bot.sendMessage(
        chatId,
        `🤖 I received your message: "${msg.text}"`
      );
    }
  });

  // Expose control state
  return {
    isBotOn: () => isBotOn,
  };
}