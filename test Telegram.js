// testTelegram.js
import TelegramBot from "node-telegram-bot-api";
import { telegramToken, telegramChatId } from "./config.js";

if (!telegramToken || !telegramChatId) {
  console.error("❌ TELEGRAM_TOKEN or TELEGRAM_CHAT_ID is missing!");
  process.exit(1);
}

const bot = new TelegramBot(telegramToken, { polling: false });

async function testMessage() {
  try {
    await bot.sendMessage(
      telegramChatId,
      "✅ Test message from Pocket Option Bot!"
    );
    console.log("📨 Test message sent to chat:", telegramChatId);
  } catch (err) {
    console.error("⚠️ Failed to send message:", err.message);
  } finally {
    process.exit(0);
  }
}

testMessage();