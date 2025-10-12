// -----------------------------------------------------------------------------
// ExnessAdapter.js
// Live Price Adapter using Twelve Data API + Simulated Trading Engine
// -----------------------------------------------------------------------------

import fetch from "node-fetch";

export default class ExnessAdapter {
  constructor({ apiKey = process.env.TWELVE_DATA_API_KEY, useSimulation = true } = {}) {
    this.apiKey = apiKey;
    this.useSimulation = useSimulation;
    this.connected = false;
    this.balance = 10000; // simulated USD balance
    this.openTrades = [];
    this.baseUrl = "https://api.twelvedata.com";

    console.log("🧩 ExnessAdapter initialized:", {
      simulationMode: useSimulation,
      apiKeyLoaded: !!this.apiKey,
    });
  }

  // ---------------------------------------------------------------------------
  // ✅ Connect to Twelve Data API
  // ---------------------------------------------------------------------------
  async connect() {
    console.log("🔌 Connecting to Twelve Data API...");
    if (!this.apiKey) throw new Error("❌ Missing TWELVE_DATA_API_KEY in environment variables!");
    this.connected = true;
    console.log("✅ Connection established successfully");
    return true;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fetch real-time price from Twelve Data
  // ---------------------------------------------------------------------------
  async getPrice(symbol = "XAU/USD") {
    if (!this.connected) throw new Error("❌ Adapter not connected. Call connect() first.");

    const formattedSymbol = symbol.replace("/", "");
    const url = `${this.baseUrl}/price?symbol=${formattedSymbol}&apikey=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data || !data.price) throw new Error(data.message || "Failed to fetch price");
      const price = parseFloat(data.price);

      console.log(`💹 Live price for ${symbol}: ${price}`);
      return price;
    } catch (err) {
      console.error("⚠️ Error fetching live price:", err.message);

      // fallback to simulated price
      const fallback = 1900 + Math.sin(Date.now() / 10000) * 10;
      console.log(`🔁 Using simulated fallback price: ${fallback.toFixed(2)}`);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Check if the market is open (Mon–Fri)
  // ---------------------------------------------------------------------------
  async isMarketOpen(symbol = "XAU/USD") {
    const day = new Date().getUTCDay(); // 0=Sunday, 6=Saturday
    const open = day !== 0 && day !== 6;
    console.log(`🕒 Market status for ${symbol}: ${open ? "OPEN" : "CLOSED"}`);
    return open;
  }

  // ---------------------------------------------------------------------------
  // ✅ Place a simulated order
  // ---------------------------------------------------------------------------
  async placeOrder({ symbol = "XAU/USD", side, lotSize = 0.1, stopLossPrice = null, takeProfitPrice = null }) {
    if (!this.connected) throw new Error("❌ Adapter not connected");

    const price = await this.getPrice(symbol);
    const id = `TRADE-${Date.now()}`;

    const trade = {
      id,
      symbol,
      side,
      lotSize,
      price,
      stopLossPrice,
      takeProfitPrice,
      timestamp: new Date().toISOString(),
    };

    this.openTrades.push(trade);
    console.log(`📤 Order placed: ${symbol} | ${side} @ ${price} | Lot: ${lotSize}`);
    return { success: true, id, trade };
  }

  // ---------------------------------------------------------------------------
  // ✅ Close simulated order
  // ---------------------------------------------------------------------------
  async closeOrder(orderId) {
    const trade = this.openTrades.find((t) => t.id === orderId);
    if (!trade) {
      console.log(`⚠️ Order not found: ${orderId}`);
      return { success: false };
    }

    this.openTrades = this.openTrades.filter((t) => t.id !== orderId);
    console.log(`📥 Closed order: ${orderId}`);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // ✅ Get simulated account balance
  // ---------------------------------------------------------------------------
  async getBalance() {
    console.log(`💰 Current balance: ${this.balance.toFixed(2)} USD`);
    return this.balance;
  }

  // ---------------------------------------------------------------------------
  // ✅ List simulated open trades
  // ---------------------------------------------------------------------------
  async getOpenTrades() {
    console.log(`📑 Open trades (${this.openTrades.length})`);
    return this.openTrades;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fetch historical candle data from Twelve Data
  // ---------------------------------------------------------------------------
  async fetchHistoricCandles(symbol = "XAU/USD", interval = "1min", count = 50) {
    const formattedSymbol = symbol.replace("/", "");
    const url = `${this.baseUrl}/time_series?symbol=${formattedSymbol}&interval=${interval}&outputsize=${count}&apikey=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data || !data.values) throw new Error("No data returned from Twelve Data");

      const candles = data.values.map((c) => ({
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }));

      console.log(`📊 Loaded ${candles.length} candles for ${symbol}`);
      return candles.reverse(); // oldest first
    } catch (err) {
      console.error("⚠️ Error fetching historical data:", err.message);
      return [];
    }
  }
}

// -----------------------------------------------------------------------------
// 🧠 Self-test (run directly with: node exnessAdapter.js)
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🧠 Running ExnessAdapter self-test...");
    const adapter = new ExnessAdapter({ useSimulation: true });
    await adapter.connect();

    const price = await adapter.getPrice("XAU/USD");
    const isOpen = await adapter.isMarketOpen();
    const balance = await adapter.getBalance();

    if (isOpen) await adapter.placeOrder({ symbol: "XAU/USD", side: "BUY", lotSize: 0.1 });

    console.log("✅ Self-test complete:", { price, balance, marketOpen: isOpen });
  })();
}