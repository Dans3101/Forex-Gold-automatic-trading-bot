// botManager.js
import { config, updateConfig, formatConfig } from "./config.js";
import { startExnessBot, stopExnessBot } from "./exnessBot.js";

let botRunning = false;

function startBot(bot) {
  console.log("🚀 Telegram Bot Manager loaded...");

  bot.onText(/\.start/, async (msg) => {
    if (botRunning) {
      await bot.sendMessage(msg.chat.id, "⚠️ Bot is already running.");
      return;
    }
    botRunning = true;
    startExnessBot(bot, msg.chat.id);
    await bot.sendMessage(msg.chat.id, "✅ Bot started.");
  });

  bot.onText(/\.stop/, async (msg) => {
    if (!botRunning) {
      await bot.sendMessage(msg.chat.id, "⚠️ Bot is not running.");
      return;
    }
    botRunning = false;
    stopExnessBot();
    await bot.sendMessage(msg.chat.id, "🛑 Bot stopped.");
  });

  // Show current settings
  bot.onText(/\.showconfig/, async (msg) => {
    await bot.sendMessage(msg.chat.id, formatConfig(), { parse_mode: "Markdown" });
  });

  // Set a config value -> .set key value
  bot.onText(/\.set (\w+) (.+)/, async (msg, match) => {
    const key = match[1];
    let value = match[2];

    // Convert numbers if possible
    if (!isNaN(value)) {
      value = Number(value);
    }

    const result = updateConfig(key, value);
    await bot.sendMessage(msg.chat.id, result, { parse_mode: "Markdown" });

    // Show updated config
    await bot.sendMessage(msg.chat.id, formatConfig(), { parse_mode: "Markdown" });
  });

  // Help menu
  bot.onText(/\.help/, async (msg) => {
    const helpText = `
🤖 *Bot Commands*

- .start → Start trading
- .stop → Stop trading
- .showconfig → Show current bot settings
- .set key value → Update setting (example: .set stopLoss 25)
- .help → Show this menu
`;
    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: "Markdown" });
  });
}

export { startBot };