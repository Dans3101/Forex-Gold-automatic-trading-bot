// config.js

// =========================
// 📌 Telegram Bot Settings
// =========================
export const telegramToken = process.env.TELEGRAM_TOKEN || "";     
// Your BotFather token

export const telegramChatId = process.env.TELEGRAM_CHAT_ID || "";  
// Telegram user ID, group ID, or channel ID where signals should be sent


// =========================
// 📌 Pocket Option Login (for scraper)
// =========================
export const email = process.env.POCKET_EMAIL || "";       
// Pocket Option account email (leave blank if no login required)

export const password = process.env.POCKET_PASSWORD || ""; 
// Pocket Option account password (leave blank if no login required)


// =========================
// 📌 Bot Signal Settings
// =========================
export const signalIntervalMinutes = Number(process.env.SIGNAL_INTERVAL) || 5; 
// How often (in minutes) to run Pocket Option scraping. Default = 5 minutes

export const decisionDelaySeconds = Number(process.env.DECISION_DELAY) || 30;  
// Delay before sending TradingView decisions (used in botManager.js)