// config.js
import dotenv from "dotenv";
dotenv.config();

// ✅ Trading configuration
const config = {
  tradeAmount: 10,               // % of balance per trade
  lotSize: 0.10,                 // Lot size per trade
  strategy: "auto",              // Auto-select strategy
  stopLoss: 20,                  // % loss before stopping
  takeProfit: 100,               // Fixed take profit in USD
  asset: "XAUUSD",               // Default symbol (Gold)
  marketOpen: true,              // Updated dynamically
  simulationMode: false           // false = use real Twelve Data prices
};

// ✅ Telegram bot configuration
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// ✅ Twelve Data API configuration
const twelveData = {
  apiKey: process.env.TWELVEDATA_API_KEY,   // your Twelve Data key
  baseUrl: "https://api.twelvedata.com",
};

// ✅ Function to toggle between simulation / live data
function toggleSimulationMode(useSim = true) {
  config.simulationMode = useSim;
  console.log(`🔁 Simulation mode: ${useSim ? "ON" : "OFF"}`);
}

// ✅ Export everything
export { config, telegramToken, telegramChatId, twelveData, toggleSimulationMode };