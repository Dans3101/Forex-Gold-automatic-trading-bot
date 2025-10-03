// config.js
// ✅ Central configuration for Exness Bot

let config = {
  tradeAmount: 10,           // % of balance per trade (default 10%)
  maxTradesPerDay: 20,       // Maximum trades allowed per day
  stopLoss: 20,              // Stop loss in % (max account loss before stop)
  takeProfit: 200,           // Take profit in % (target profit before stop)
  strategy: "movingaverage", // Default strategy
  symbol: "XAUUSD",          // Default trading pair
  lotSize: 0.01,             // Default lot size
  leverage: 100,             // Default leverage
};

// ✅ Update a setting dynamically
function updateConfig(key, value) {
  if (config.hasOwnProperty(key)) {
    config[key] = value;
    return `✅ Updated *${key}* to *${value}*`;
  }
  return `⚠️ Setting *${key}* not found. Use .showconfig to see options.`;
}

// ✅ Get current config
function getConfig() {
  return config;
}

// ✅ Display config nicely for Telegram
function formatConfig() {
  return `
⚙️ *Current Bot Settings* ⚙️

- Trade Amount: ${config.tradeAmount}%
- Max Trades/Day: ${config.maxTradesPerDay}
- Stop Loss: ${config.stopLoss}%
- Take Profit: ${config.takeProfit}%
- Strategy: ${config.strategy}
- Symbol: ${config.symbol}
- Lot Size: ${config.lotSize}
- Leverage: ${config.leverage}x
`;
}

export { config, updateConfig, getConfig, formatConfig };