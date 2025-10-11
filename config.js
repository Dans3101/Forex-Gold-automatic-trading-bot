// config.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Trading configuration
const config = {
  tradeAmount: 10,               // % of balance per trade (default)
  lotSize: 0.10,                 // Adjustable lot size (0.01 - 10)
  strategy: "auto",              // Bot auto-detects best strategy
  stopLoss: 20,                  // % loss before stopping
  takeProfit: 100,               // Fixed take profit in USD (not %)
  asset: "XAUUSD",               // Default trading asset
  marketOpen: true,              // Updated dynamically by ExnessAdapter
  simulationMode: true           // true = simulate; false = connect to live Exness account
};

// ✅ Telegram bot configuration
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// ✅ Exness account credentials
const exness = {
  loginId: process.env.EXNESS_LOGIN_ID,
  password: process.env.EXNESS_PASSWORD,
  server: process.env.EXNESS_SERVER, // e.g. "Exness-MT5Trial"
};

// ✅ Function to toggle live/simulation mode easily
function toggleSimulationMode(useSim = true) {
  config.simulationMode = useSim;
  console.log(`🔁 Simulation mode: ${useSim ? "ON" : "OFF"}`);
}

// ✅ Export everything
export { config, telegramToken, telegramChatId, exness, toggleSimulationMode };