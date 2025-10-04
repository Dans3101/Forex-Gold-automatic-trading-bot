// strategies.js
// Trading strategies for XAUUSD (Gold)

export function movingAverageStrategy(data) {
  // Example: Compare short MA vs long MA
  const shortMA = data.close.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const longMA = data.close.slice(-20).reduce((a, b) => a + b, 0) / 20;
  return shortMA > longMA ? "BUY" : "SELL";
}

export function macdStrategy(data) {
  // Example: Use last histogram value
  const hist = data.macdHistogram[data.macdHistogram.length - 1];
  return hist > 0 ? "BUY" : "SELL";
}

export function stochasticStrategy(data) {
  // Example: Overbought / Oversold
  const k = data.stochasticK[data.stochasticK.length - 1];
  return k > 80 ? "SELL" : k < 20 ? "BUY" : "HOLD";
}

export function bollingerStrategy(data) {
  // Example: Price vs bands
  const price = data.close[data.close.length - 1];
  if (price > data.bollinger.upper) return "SELL";
  if (price < data.bollinger.lower) return "BUY";
  return "HOLD";
}

// Combine strategies
export function combinedDecision(data, activeStrategies = []) {
  const votes = activeStrategies.map((s) => {
    switch (s) {
      case "ma": return movingAverageStrategy(data);
      case "macd": return macdStrategy(data);
      case "stochastic": return stochasticStrategy(data);
      case "bollinger": return bollingerStrategy(data);
      default: return "HOLD";
    }
  });

  // Majority voting
  const buys = votes.filter(v => v === "BUY").length;
  const sells = votes.filter(v => v === "SELL").length;
  if (buys > sells) return "BUY";
  if (sells > buys) return "SELL";
  return "HOLD";
}
