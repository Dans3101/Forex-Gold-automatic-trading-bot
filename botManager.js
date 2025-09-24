// botManager.js

import { getPocketData } from "./pocketscraper.js";
import {
  telegramChatId,
  signalIntervalMinutes,
  decisionDelaySeconds,
} from "./config.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Configured Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
let signalInterval;

/**
 * Start trading signal bot
 * @param {TelegramBot} bot - The Telegram bot instance from index.js
 */
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  console.log("✅ Telegram bot manager ready. Listening for commands...");

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    console.log(`📩 Message from ${chatId}: ${text}`);

    // Only respond if message is from the configured chat
    if (String(chatId) !== String(telegramChatId)) {
      console.log("⏩ Ignored message (not from configured chat).");
      return;
    }

    // --- Start bot ---
    if (text === ".on") {
      if (isBotOn) {
        await bot.sendMessage(chatId, "⚠️ Bot is already running.");
        return;
      }

      isBotOn = true;
      await bot.sendMessage(
        chatId,
        `🤖 Trading signals bot *activated*!  
Sending 1 random signal every ${signalIntervalMinutes} minutes...`,
        { parse_mode: "Markdown" }
      );

      signalInterval = setInterval(async () => {
        try {
          const results = await getPocketData();

          if (results.length > 0) {
            const r = results[Math.floor(Math.random() * results.length)];

            await bot.sendMessage(chatId, `📊 Asset: ${r.asset}`);

            // Delay before decision
            await new Promise((resolve) =>
              setTimeout(resolve, decisionDelaySeconds * 1000)
            );

            await bot.sendMessage(chatId, `📌 Decision: ${r.decision}`);
          } else {
            await bot.sendMessage(chatId, "⚠️ No signals available right now.");
          }
        } catch (err) {
          console.error("❌ Error while fetching signals:", err);
          await bot.sendMessage(
            chatId,
            "⚠️ Error occurred while generating signals. Check logs."
          );
        }
      }, signalIntervalMinutes * 60 * 1000);
    }

    // --- Stop bot ---
    else if (text === ".off") {
      if (!isBotOn) {
        await bot.sendMessage(chatId, "⚠️ Bot is already stopped.");
        return;
      }

      clearInterval(signalInterval);
      isBotOn = false;
      await bot.sendMessage(chatId, "⛔ Trading signals bot *stopped!*", {
        parse_mode: "Markdown",
      });
    }

    // --- Unknown command ---
    else {
      await bot.sendMessage(chatId, "❓ Unknown command. Use `.on` or `.off`.");
    }
  });
}