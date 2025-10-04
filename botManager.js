import TelegramBot from "node-telegram-bot-api";
import { config } from "./config.js";

const bot = new TelegramBot(config.telegramToken, { polling: true });

/* ------------------ STRATEGY COMMANDS ------------------ */

// ✅ Change primary strategy (single or multi)
bot.onText(/\/setstrategy (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  const input = match[1].toLowerCase().trim();
  const validStrategies = ["sma", "ema", "bollinger", "macd", "multi"];

  if (!validStrategies.includes(input)) {
    bot.sendMessage(
      msg.chat.id,
      `⚠️ Invalid strategy. Options: ${validStrategies.join(", ")}`
    );
    return;
  }

  config.strategy = input;
  bot.sendMessage(msg.chat.id, `✅ Trading strategy set to: ${input.toUpperCase()}`);
});

// ✅ Change active strategies inside "multi"
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
  bot.sendMessage(msg.chat.id, `✅ Multi-strategies updated:\n${selected.join(", ")}`);
});

// ✅ Check current setup
bot.onText(/\/getstrategy/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  if (config.strategy === "multi") {
    bot.sendMessage(
      msg.chat.id,
      `📊 Current strategy: MULTI\n📋 Active strategies: ${config.strategies.join(", ")}`
    );
  } else {
    bot.sendMessage(msg.chat.id, `📊 Current strategy: ${config.strategy.toUpperCase()}`);
  }
});

/* ------------------ AUTO TRADING TOGGLE ------------------ */

bot.onText(/\/autoon/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  config.autoTrading = true;
  bot.sendMessage(msg.chat.id, "✅ Auto-trading has been ENABLED. The bot will now place trades.");
});

bot.onText(/\/autooff/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  config.autoTrading = false;
  bot.sendMessage(msg.chat.id, "🛑 Auto-trading has been DISABLED. The bot will not place trades.");
});

bot.onText(/\/autostatus/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  const status = config.autoTrading ? "✅ ENABLED" : "🛑 DISABLED";
  bot.sendMessage(msg.chat.id, `📊 Auto-trading status: ${status}`);
});

export { bot };