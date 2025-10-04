import TelegramBot from "node-telegram-bot-api";
import { config } from "./config.js";

const bot = new TelegramBot(config.telegramToken, { polling: true });

// ✅ Command to change strategies dynamically
bot.onText(/\/setstrategies (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  const input = match[1].split(" ").map(s => s.toLowerCase().trim());
  const validStrategies = ["sma", "ema", "bollinger", "macd"];

  const selected = input.filter(s => validStrategies.includes(s));

  if (selected.length === 0) {
    bot.sendMessage(msg.chat.id, `⚠️ Invalid strategies. Options: ${validStrategies.join(", ")}`);
    return;
  }

  config.strategies = selected;
  bot.sendMessage(msg.chat.id, `✅ Active multi-strategies updated:\n${selected.join(", ")}`);
});

// ✅ Command to check current strategies
bot.onText(/\/getstrategies/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;
  bot.sendMessage(msg.chat.id, `📊 Current multi-strategies: ${config.strategies.join(", ")}`);
});

export { bot };