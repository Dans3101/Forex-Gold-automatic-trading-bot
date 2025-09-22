// config.js

// 📌 Telegram Bot Settings
export const telegramToken = process.env.TELEGRAM_TOKEN || "";   // BotFather token
export const telegramChatId = process.env.TELEGRAM_CHAT_ID || ""; // Channel or group ID

// 📌 Pocket Option Login
export const email = process.env.POCKET_EMAIL || "";       // Pocket Option account email
export const password = process.env.POCKET_PASSWORD || ""; // Pocket Option account password

// 📌 Bot Signal Settings
export const signalIntervalMinutes = Number(process.env.SIGNAL_INTERVAL) || 5; // default: 5 min
export const decisionDelaySeconds = Number(process.env.DECISION_DELAY) || 30;  // default: 30 sec