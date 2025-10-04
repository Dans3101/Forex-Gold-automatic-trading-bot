// config.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Trading config
const config = {
  tradeAmount: 10,              // % of balance per trade
  strategy: "movingAverage",    // default strategy
  stopLoss: 20,                 // % loss before stopping
  takeProfit: 200,              // % profit before stopping
  asset: "XAUUSD",              // default asset
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