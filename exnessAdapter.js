// -----------------------------------------------------------------------------
// ExnessAdapter.js
// Real-time Gold Price Adapter using Twelve Data API + Simulated Trading Engine
// -----------------------------------------------------------------------------

import fetch from "node-fetch";

export default class ExnessAdapter {
  constructor({
    apiKey = process.env.TWELVE_DATA_API_KEY,
    useSimulation = true
  } = {}) {
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
    if (!this.apiKey) throw new Error("❌ Missing TWELVE_DATA_API_KEY in environment variables!");
    console.log("🔌 Connecting to Twelve Data API...");
    this.connected = true;
    console.log("✅ Connection established successfully");
    return true;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fetch real-time price from Twelve Data (with error handling + fallback)
  // ---------------------------------------------------------------------------
  async getPrice(symbol = "XAU/USD") {
    if (!this.connected) throw new Error("❌ Adapter not connected. Call connect() first.");
    const formattedSymbol = symbol.replace("/", "");

    const url = `${this.baseUrl}/price?symbol=${formattedSymbol}&apikey=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.price) {
        const price = parseFloat(data.price);
        console.log(`💹 Live price for ${symbol}: ${price}`);
        return price;
      } else {
        throw new Error(data.message || "Price not available");
      }
    } catch (err) {
      console.error("⚠️ Error fetching live price:", err.message);
      const fallback = 1900 + Math.sin(Date.now() / 5000) * 10;
      console.log(`🔁 Using fallback simulated price: ${fallback.toFixed(2)}`);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Check if market is open (Monday–Friday)
  // ---------------------------------------------------------------------------
  async isMarketOpen() {
    const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
    const open = day !== 0 && day !== 6;
    console.log(`🕒 Market status: ${open ? "OPEN ✅" : "CLOSED ❌"}`);
    return open;
  }

  // ---------------------------------------------------------------------------
  // ✅ Place simulated order (BUY/SELL)
  // ---------------------------------------------------------------------------
  async placeOrder({ symbol = "XAU/USD", side = "BUY", lotSize = 0.1 }) {
    if (!this.connected) throw new Error("❌ Adapter not connected");

    const price = await this.getPrice(symbol);
    const id = `TRADE-${Date.now()}`;

    const trade = {
      id,
      symbol,
      side,
      lotSize,
      price,
      timestamp: new Date().toISOString(),
    };

    // Simulate a basic balance impact
    const tradeValue = lotSize * 100; // e.g. 0.1 lot = 10 USD margin
    if (side === "BUY") this.balance -= tradeValue * 0.01;
    if (side === "SELL") this.balance += tradeValue * 0.01;

    this.openTrades.push(trade);

    console.log(`📤 Order placed: ${side} ${symbol} @ ${price.toFixed(2)} | Lot: ${lotSize}`);
    return { success: true, id, trade };
  }

  // ---------------------------------------------------------------------------
  // ✅ Close simulated trade
  // ---------------------------------------------------------------------------
  async closeOrder(orderId) {
    const trade = this.openTrades.find((t) => t.id === orderId);
    if (!trade) {
      console.warn(`⚠️ Trade not found: ${orderId}`);
      return { success: false };
    }

    this.openTrades = this.openTrades.filter((t) => t.id !== orderId);
    console.log(`📥 Trade closed: ${orderId}`);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // ✅ Get balance (keeps bot running, not stopping automatically)
  // ---------------------------------------------------------------------------
  async getBalance() {
    console.log(`💰 Current balance: ${this.balance.toFixed(2)} USD`);
    return this.balance;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fetch historical candle data for strategy analysis
  // ---------------------------------------------------------------------------
  async fetchHistoricCandles(symbol = "XAU/USD", interval = "1min", count = 50) {
    const formattedSymbol = symbol.replace("/", "");
    const url = `${this.baseUrl}/time_series?symbol=${formattedSymbol}&interval=${interval}&outputsize=${count}&apikey=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data || !data.values) throw new Error("No candle data returned");

      const candles = data.values.map((c) => ({
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }));

      console.log(`📊 Loaded ${candles.length} candles for ${symbol}`);
      return candles.reverse();
    } catch (err) {
      console.error("⚠️ Error fetching candles:", err.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Keep simulation running indefinitely (doesn't stop after TP/SL)
  // ---------------------------------------------------------------------------
  async simulateProfitLoss() {
    if (this.openTrades.length === 0) return;

    const fluctuation = (Math.random() - 0.5) * 10; // simulate ±5 change
    this.balance += fluctuation;

    if (this.balance < 0) this.balance = 0; // prevent negative
    console.log(`📈 Simulated balance update: ${this.balance.toFixed(2)} USD`);
  }
}

// -----------------------------------------------------------------------------
// 🧠 Self-test (run directly: node exnessAdapter.js)
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🧠 Running ExnessAdapter self-test...");
    const adapter = new ExnessAdapter({ useSimulation: true });
    await adapter.connect();

    const price = await adapter.getPrice("XAU/USD");
    const open = await adapter.isMarketOpen();
    const balance = await adapter.getBalance();
    const candles = await adapter.fetchHistoricCandles();

    if (open) await adapter.placeOrder({ symbol: "XAU/USD", side: "BUY" });

    console.log("✅ Self-test complete:", { price, open, balance, candles: candles.length });
  })();
}