// config.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Trading config
const config = {
  tradeAmount: 10,              // % of balance per trade (default)
  lotSize: 0.1,                 // Adjustable lot size (default: 0.1, range: 0.01 - 10)
  strategy: "movingAverage",    // Default strategy
  stopLoss: 20,                 // % loss before stopping
  takeProfit: 100,              // Fixed profit target in USD
  asset: "XAUUSD",              // Default asset
  marketOpen: true              // Flag to show if market is open (to be updated dynamically)
};

// ✅ Telegram bot settings
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// ✅ Exness login details
const exness = {
  loginId: process.env.EXNESS_LOGIN_ID,
  password: process.env.EXNESS_PASSWORD,
  server: process.env.EXNESS_SERVER,   // e.g. "Exness-MT5Trial"
};

// ✅ Export everything
export { config, telegramToken, telegramChatId, exness };