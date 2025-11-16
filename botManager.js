import TelegramBot from "node-telegram-bot-api";
import { config } from "./config.js";

const bot = new TelegramBot(config.telegramToken, { polling: true });

/* -------------------------------------------------------
   📌 PAYMENT SYSTEM CONFIG (SmartGlocal / BotFather Token)
--------------------------------------------------------*/
const PAYMENT_PROVIDER_TOKEN = config.paymentToken; 
// Example: config.paymentToken = "12345:TEST:PAYMENT"

/* -------------------------------------------------------
   📦 PRODUCTS / PRICES (You can edit freely)
--------------------------------------------------------*/
const PRODUCTS = [
  {
    id: "basic_signals",
    title: "📉 Basic Gold Signals (1 Week)",
    description: "Includes buy/sell alerts for XAUUSD using EMA strategy.",
    price: 30000, // in KES cents → 300 KES
  },
  {
    id: "premium_signals",
    title: "🏆 Premium Gold Signals (1 Month)",
    description: "Advanced multi-strategy signals + insights.",
    price: 100000, // 1000 KES
  }
];

/* -------------------------------------------------------
   🛒 COMMAND: /prices (list all products)
--------------------------------------------------------*/
bot.onText(/\/prices/, (msg) => {
  let text = "🛒 *Available Packages:*\n\n";
  for (const p of PRODUCTS) {
    text += `• *${p.title}* — ${p.price / 100} KES\n`;
  }
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

/* -------------------------------------------------------
   🛍 COMMAND: /buy <product_id>
--------------------------------------------------------*/
bot.onText(/\/buy (.+)/, (msg, match) => {
  const productId = match[1].trim();
  const chatId = msg.chat.id;

  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) {
    return bot.sendMessage(chatId, "❌ Invalid product ID.\nUse /prices to see available items.");
  }

  bot.sendInvoice(
    chatId,
    product.title,
    product.description,
    product.id,    // payload
    PAYMENT_PROVIDER_TOKEN,
    "payment",     // start parameter
    "KES",         // currency
    [{ label: product.title, amount: product.price }]
  );
});

/* -------------------------------------------------------
   🔐 Telegram requirement: Pre-checkout confirmation
--------------------------------------------------------*/
bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch(console.error);
});

/* -------------------------------------------------------
   🎉 Successful payment handler
--------------------------------------------------------*/
bot.on("successful_payment", (msg) => {
  const chatId = msg.chat.id;
  const productId = msg.successful_payment.invoice_payload;

  bot.sendMessage(
    chatId,
    `🎉 *Payment Successful!*\n\n` +
      `Thank you for purchasing: *${productId}*\n` +
      `Your package is now active.`,
    { parse_mode: "Markdown" }
  );
});

/* -------------------------------------------------------
   STRATEGY COMMANDS (Your existing code untouched)
--------------------------------------------------------*/

// Change primary strategy
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

// Change multi strategies
bot.onText(/\/setstrategies (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  const input = match[1].split(" ").map(s => s.toLowerCase().trim());
  const validStrategies = ["sma", "ema", "bollinger", "macd"];

  const selected = input.filter(s => validStrategies.includes(s));
  if (selected.length === 0) {
    bot.sendMessage(
      msg.chat.id,
      `⚠️ Invalid strategies. Options: ${validStrategies.join(", ")}`
    );
    return;
  }

  config.strategies = selected;
  bot.sendMessage(
    msg.chat.id,
    `✅ Multi-strategies updated:\n${selected.join(", ")}`
  );
});

// Show current strategy
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
  bot.sendMessage(msg.chat.id, "✅ Auto-trading ENABLED.");
});

bot.onText(/\/autooff/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  config.autoTrading = false;
  bot.sendMessage(msg.chat.id, "🛑 Auto-trading DISABLED.");
});

bot.onText(/\/autostatus/, (msg) => {
  if (msg.chat.id.toString() !== config.telegramChatId) return;

  const status = config.autoTrading ? "ENABLED ✅" : "DISABLED 🛑";
  bot.sendMessage(msg.chat.id, `📊 Auto-trading status: ${status}`);
});

export { bot };