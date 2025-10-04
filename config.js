// config.js
export const config = {
  telegramToken: process.env.TELEGRAM_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,

  // Trading settings
  accountId: process.env.EXNESS_ACCOUNT_ID,
  password: process.env.EXNESS_PASSWORD,
  server: process.env.EXNESS_SERVER,

  asset: "XAUUSD",
  strategy: "multi", // default to multi
  strategies: ["sma", "ema", "bollinger", "macd"], // strategies used in multi

  tradeAmount: 1.0,
  maxTrades: 20,
  profitTarget: 200,
  lossLimit: 20,
};