// botManager.js

import TelegramBot from "node-telegram-bot-api";
import { getPocketData } from "./pocketscraper.js";
import {
  telegramToken,
  telegramChatId,
  signalIntervalMinutes,
  decisionDelaySeconds,
} from "./config.js";

console.log("🚀 Telegram Bot Manager loaded...");
console.log("🤖 Telegram Token:", telegramToken ? "✅ Set" : "❌ Missing");
console.log("👥 Target Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
let signalInterval;
let bot;

// ✅ Start Telegram bot
export function startBot() {
  if (!telegramToken) {
    console.error("❌ No TELEGRAM_TOKEN found in config.js or env vars");
    return;
  }

  bot = new TelegramBot(telegramToken, { polling: true });

  bot.on("polling_error", (err) => console.error("Polling error:", err));

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim().toLowerCase();

    // Only respond if coming from your configured chat/group/channel
    if (String(chatId) !== String(telegramChatId)) return;

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
        await bot.sendMessage(
          chatId,
          "⛔ Trading signals bot *stopped*!",
          { parse_mode: "Markdown" }
        );
      }
    }
  });

  console.log("✅ Telegram bot started and polling...");
}