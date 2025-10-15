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
  simulationMode: false          // false = use real Finnhub prices
};

// ✅ Telegram bot configuration
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// ✅ Finnhub API configuration
const finnhub = {
  apiKey: process.env.FINNHUB_API_KEY,        // Your Finnhub key
  baseUrl: "https://finnhub.io/api/v1",
  wsUrl: "wss://ws.finnhub.io?token=" + process.env.FINNHUB_API_KEY
};

// ✅ Function to toggle between simulation / live data
function toggleSimulationMode(useSim = true) {
  config.simulationMode = useSim;
  console.log(`🔁 Simulation mode: ${useSim ? "ON" : "OFF"}`);
}

// ✅ Export everything
export { config, telegramToken, telegramChatId, finnhub, toggleSimulationMode };