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
const knownChats = new Set();

// ✅ Start Telegram bot (use bot instance from index.js)
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

    // ✅ Restrict trading commands if TELEGRAM_CHAT_ID is set
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
    } else {
      // ✅ Always reply to any message
      await bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}"`);
    }
  });

  console.log("✅ Telegram bot manager hooked into events...");
}