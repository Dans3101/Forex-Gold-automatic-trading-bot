// botManager.js

// ✅ Core modules
import TelegramBot from "node-telegram-bot-api";

// ✅ Config (env variables)
import {
  telegramToken,
  telegramChatId, // Group/Channel ID
  signalIntervalMinutes,
  decisionDelaySeconds,
} from "./config.js";

// ✅ Pocket Option scraper
import { getPocketData } from "./pocketscraper.js";

// Logs
console.log("🚀 Bot Manager loaded...");
console.log("🤖 Telegram Bot Token:", telegramToken ? "✅ Set" : "❌ Missing");
console.log("👥 Telegram Chat ID:", telegramChatId || "❌ Not set");

let isBotOn = false;
let signalInterval;

let bot;

// ✅ Start Telegram Bot
export function startBot() {
  if (!telegramToken) {
    console.error("❌ Missing Telegram bot token. Please set it in config.js");
    return;
  }

  bot = new TelegramBot(telegramToken, { polling: true });

  bot.on("polling_error", (err) => console.error("Polling error:", err.message));

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.toLowerCase() || "";

    if (chatId.toString() !== telegramChatId.toString()) return;

    if (text === ".on") {
      if (!isBotOn) {
        isBotOn = true;
        await bot.sendMessage(
          telegramChatId,
          `🤖 Trading signals bot *activated*! Sending 1 random signal every ${signalIntervalMinutes} minutes...`,
          { parse_mode: "Markdown" }
        );

        signalInterval = setInterval(async () => {
          const results = await getPocketData();

          if (results.length > 0) {
            const randomIndex = Math.floor(Math.random() * results.length);
            const r = results[randomIndex];

            await bot.sendMessage(
              telegramChatId,
              `📊 *Asset:* ${r.asset}`,
              { parse_mode: "Markdown" }
            );

            await new Promise((resolve) =>
              setTimeout(resolve, decisionDelaySeconds * 1000)
            );

            await bot.sendMessage(
              telegramChatId,
              `📌 *Decision:* ${r.decision}`,
              { parse_mode: "Markdown" }
            );
          } else {
            await bot.sendMessage(
              telegramChatId,
              "⚠️ No signals available right now."
            );
          }
        }, signalIntervalMinutes * 60 * 1000);
      }
    } else if (text === ".off") {
      if (isBotOn) {
        clearInterval(signalInterval);
        isBotOn = false;
        await bot.sendMessage(
          telegramChatId,
          "⛔ Trading signals bot *stopped*!"
        );
      }
    }
  });

  console.log("✅ Telegram bot started and listening...");
}