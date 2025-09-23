// getChatId.js
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

// ✅ Load bot token from .env or hardcode it
const token = process.env.TELEGRAM_TOKEN || "<PUT_YOUR_TOKEN_HERE>";

// Create bot in polling mode
const bot = new TelegramBot(token, { polling: true });

console.log("🤖 Send a message to your bot (in chat, group, or channel)...");

bot.on("message", (msg) => {
  console.log("✅ Chat detected!");
  console.log("Chat ID:", msg.chat.id);
  console.log("Chat Type:", msg.chat.type);
  console.log("Chat Title/Name:", msg.chat.title || msg.chat.first_name);

  // Optional: Reply back so you know it’s working
  bot.sendMessage(msg.chat.id, `Your Chat ID is: ${msg.chat.id}`);

  // Exit after showing ID
  process.exit(0);
});