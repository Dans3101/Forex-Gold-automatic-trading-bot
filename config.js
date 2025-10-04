export const config = {
  // --- Telegram Bot ---
  telegramToken: process.env.TELEGRAM_TOKEN, // from BotFather
  telegramChatId: process.env.TELEGRAM_CHAT_ID, // your chat ID

  // --- Exness Login ---
  loginId: process.env.EXNESS_LOGIN_ID,
  password: process.env.EXNESS_PASSWORD,
  server: process.env.EXNESS_SERVER, // e.g., "Exness-MT5Trial"

  // --- Trading Settings ---
  symbol: "XAUUSD", // default instrument
  lotSize: 0.1, // adjust position size
  strategy: "multi", // default: multi strategy
  strategies: ["sma", "ema", "bollinger", "macd"], // used only if strategy = multi
  autoTrading: false, // 🛑 start with auto-trading OFF

  // --- Risk Management ---
  stopLoss: -200,   // stop if loss hits -200 USD
  takeProfit: 400,  // stop if profit hits +400 USD
};