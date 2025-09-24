// botManager.js

import { getPocketData } from "./pocketscraper.js";
import {
  telegramChatId,
  signalIntervalMinutes,
  decisionDelaySeconds,
} from "./config.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("👥 Target Chat ID from config:", telegramChatId || "❌ Not set");

let isBotOn = false;
let signalInterval;
const knownChats = new Set(); // ✅ Track chats we already introduced ourselves to

// ✅ Start Telegram bot (use bot instance from index.js)
export function startBot(bot) {
  if (!bot) {
    console.error("❌ No bot instance passed into startBot()");
    return;
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    // ✅ Always log chat ID in Render logs
    console.log(`💬 Message from chat ID: ${chatId}, text: ${text}`);

    // ✅ Auto-send chat ID the first time this chat interacts
    if (!knownChats.has(chatId)) {
      knownChats.add(chatId);
      await bot.sendMessage(
        chatId,
        `👋 Hello! Thanks for messaging me.\n\n🆔 Your Chat ID is: \`${chatId}\`\n\n⚙️ Save this ID in your config (.env) as *TELEGRAM_CHAT_ID* to let me send signals here.`,
        { parse_mode: "Markdown" }
      );
    }

    // ✅ Always tell the user their chat ID if they ask
    if (text === "/id") {
      await bot.sendMessage(chatId, `🆔 Your Chat ID is: \`${chatId}\``, {
        parse_mode: "Markdown",
      });
      return;
    }

    // ✅ Restrict bot control if telegramChatId is set
    if (telegramChatId && String(chatId) !== String(telegramChatId)) {
      await bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to control this bot."
      );
      return;
    }

    // --- Commands ---
    if (text === ".on") {
      if (!isBotOn) {
        isBotOn = true;
        await bot.sendMessage(
          chatId,
          `🤖 Trading signals bot *activated*! Sending 1 random signal every ${signalIntervalMinutes} minutes...`,
          { parse_mode: "Markdown" }
        );

        signalInterval = setInterval(async () => {
          const results = await getPocketData();

          if (results.length > 0) {
            const randomIndex = Math.floor(Math.random() * results.length);
            const r = results[randomIndex];

            await bot.sendMessage(chatId, `📊 Asset: ${r.asset}`);

            await new Promise((resolve) =>
              setTimeout(resolve, decisionDelaySeconds * 1000)
            );

            await bot.sendMessage(chatId, `📌 Decision: ${r.decision}`);
          } else {
            await bot.sendMessage(chatId, "⚠️ No signals available right now.");
          }
        }, signalIntervalMinutes * 60 * 1000);
      }
    } else if (text === ".off") {
      if (isBotOn) {
        clearInterval(signalInterval);
        isBotOn = false;
        await bot.sendMessage(chatId, "⛔ Trading signals bot *stopped!*", {
          parse_mode: "Markdown",
        });
      }
    }
  });

  console.log("✅ Telegram bot manager hooked into events...");
}