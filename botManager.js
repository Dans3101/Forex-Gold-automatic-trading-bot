// botManager.js
import { telegramChatId, signalIntervalMinutes } from "./config.js";
import { getPocketSignals } from "./pocketscraper.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
const knownChats = new Set();
let scraperInterval = null;

/* ✅ Utility: Send a Telegram message */
async function sendTelegramMessage(bot, text) {
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

/* ✅ Start the bot */
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  // 📩 Handle incoming messages
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    // Send chat ID for first-time users
    if (!knownChats.has(chatId)) {
      knownChats.add(chatId);
      await bot.sendMessage(
        chatId,
        `👋 Hello! Your Chat ID is: \`${chatId}\`\n\nSave this ID in your .env as *TELEGRAM_CHAT_ID* to receive signals here.`,
        { parse_mode: "Markdown" }
      );
    }

    // /id command
    if (text === "/id") {
      await bot.sendMessage(chatId, `🆔 Your Chat ID is: \`${chatId}\``, {
        parse_mode: "Markdown",
      });
      return;
    }

    // Restrict unauthorized users
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
          `✅ Signal forwarding *enabled*!\n\n⏳ I will fetch PocketOption signals every *${signalIntervalMinutes} minutes*.\nBoth Normal & Strong signals will be sent.`,
          { parse_mode: "Markdown" }
        );

        // Start signal loop
        scraperInterval = setInterval(async () => {
          try {
            console.log("🔍 Fetching PocketOption signals...");
            const signals = await getPocketSignals(5); // fetch last 5 signals

            if (signals.length > 0) {
              for (const sig of signals) {
                await sendTelegramMessage(
                  bot,
                  `📢 *Chat Signal* (${sig.strength})\nDecision: *${sig.decision}*\n📝 Raw: ${sig.raw}`
                );
              }
            } else {
              console.log("ℹ️ No signals detected this cycle.");
            }
          } catch (err) {
            console.error("❌ Scraper error:", err.message);
            await sendTelegramMessage(bot, "⚠️ Error fetching signals. Check logs.");
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

  return { isBotOn: () => isBotOn };
}