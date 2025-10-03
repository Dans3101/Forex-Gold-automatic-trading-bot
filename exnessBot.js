// exnessBot.js
import { config } from "./config.js";
import { applyStrategy } from "./strategies.js";

let botActive = false;
let intervalId = null;

/**
 * Start Exness trading bot
 */
function startExnessBot(bot, chatId) {
  if (botActive) return;
  botActive = true;

  bot.sendMessage(chatId, "📈 Exness trading bot started...");

  intervalId = setInterval(async () => {
    if (!botActive) return;

    try {
      // Always pull the latest config values
      const { tradeAmount, strategy, stopLoss, takeProfit, asset } = config;

      // Apply strategy
      const decision = applyStrategy(strategy, asset);

      // Mock trade execution (replace with Exness API later)
      console.log(`📌 Trade Decision: ${decision} on ${asset} with ${tradeAmount}% balance`);

      // Send decision to Telegram
      await bot.sendMessage(
        chatId,
        `📊 Strategy: *${strategy}*\nAsset: *${asset}*\nDecision: *${decision}*\nTrade Amount: *${tradeAmount}%*`,
        { parse_mode: "Markdown" }
      );

      // Stop condition check
      if (Math.random() * 100 < stopLoss) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🛑 Bot stopped due to Stop Loss condition.");
      }

      if (Math.random() * 100 < takeProfit) {
        stopExnessBot();
        await bot.sendMessage(chatId, "🎉 Bot stopped due to Take Profit condition.");
      }

    } catch (err) {
      console.error("❌ Bot error:", err.message);
      await bot.sendMessage(chatId, `❌ Bot error: ${err.message}`);
    }
  }, 15000); // Run every 15s
}

/**
 * Stop Exness trading bot
 */
function stopExnessBot() {
  botActive = false;
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  console.log("🛑 Exness bot stopped.");
}

export { startExnessBot, stopExnessBot };