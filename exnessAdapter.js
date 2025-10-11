// exnessAdapter.js
// -----------------------------------------------------------------------------
// Simulation-ready Exness Adapter (with Console Test Logs)
// -----------------------------------------------------------------------------
// This adapter simulates a full Exness/MT5 broker connection — allowing your bot
// to run and trade automatically even without a real Exness API or Puppeteer.
// When you're ready for a live connection, you can plug in MetaApi or another
// SDK inside the same methods.
// -----------------------------------------------------------------------------

export default class ExnessAdapter {
  constructor({ loginId, password, server, useSimulation = true }) {
    this.loginId = loginId;
    this.password = password;
    this.server = server;
    this.useSimulation = useSimulation;
    this.connected = false;
    this.balance = 10000; // 💰 simulated USD balance
    this.openTrades = [];

    console.log("🧩 ExnessAdapter initialized", {
      loginId,
      server,
      simulation: useSimulation,
    });
  }

  /**
   * Simulate connecting to Exness/MT5 broker
   */
  async connect() {
    console.log("🔌 Attempting to connect to Exness server...");
    await new Promise((res) => setTimeout(res, 1000)); // fake delay
    this.connected = true;
    console.log("✅ ExnessAdapter: Simulated connection established", {
      loginId: this.loginId,
      server: this.server,
      simulation: this.useSimulation,
    });
    return true;
  }

  /**
   * Simulated live price feed
   * Generates simple fluctuating price based on asset type and time
   */
  async getPrice(symbol) {
    const base = symbol.toUpperCase().includes("XAU") ? 1900 : 1.0;
    const t = Date.now() / 10000;
    const volatility = symbol.toUpperCase().includes("XAU") ? 20 : 0.005;
    const price = +(base + Math.sin(t) * volatility).toFixed(6);

    console.log(`💹 Price fetched for ${symbol}: ${price}`);
    return price;
  }

  /**
   * Check whether the market is open (Monday–Friday)
   */
  async isMarketOpen(symbol) {
    const day = new Date().getUTCDay(); // 0 = Sunday, 6 = Saturday
    const open = day !== 0 && day !== 6;
    console.log(`🕒 Market status for ${symbol}: ${open ? "OPEN" : "CLOSED"}`);
    return open;
  }

  /**
   * Simulate placing a trade
   */
  async placeOrder({ symbol, side, lotSize, stopLossPrice = null, takeProfitPrice = null }) {
    if (!this.connected) throw new Error("Adapter not connected");

    const id = `SIM-${Date.now()}`;
    const price = await this.getPrice(symbol);

    const trade = {
      id,
      symbol,
      side,
      lotSize,
      price,
      stopLossPrice,
      takeProfitPrice,
      timestamp: new Date(),
    };

    this.openTrades.push(trade);
    console.log(`📤 Simulated order placed: ${symbol} | ${side} @ ${price} | Lot: ${lotSize}`);

    return { success: true, id, trade };
  }

  /**
   * Simulate closing a trade by ID
   */
  async closeOrder(orderId) {
    const initialCount = this.openTrades.length;
    this.openTrades = this.openTrades.filter((o) => o.id !== orderId);

    if (this.openTrades.length < initialCount) {
      console.log(`📥 Order closed: ${orderId}`);
      return { success: true };
    } else {
      console.log(`⚠️ Order not found: ${orderId}`);
      return { success: false, message: "Order not found" };
    }
  }

  /**
   * Get a list of simulated open trades
   */
  async getOpenTrades() {
    console.log(`📑 Currently open trades: ${this.openTrades.length}`);
    return this.openTrades;
  }

  /**
   * Get simulated account balance
   */
  async getBalance() {
    console.log(`💰 Current simulated balance: ${this.balance} USD`);
    return this.balance;
  }

  /**
   * (Optional) Fetch historical candles for strategies
   * You can later plug in real candle data here from Exness API or MetaApi.
   */
  async fetchHistoricCandles(symbol, timeframe = "1m", count = 100) {
    const candles = [];
    const basePrice = await this.getPrice(symbol);
    for (let i = 0; i < count; i++) {
      const open = basePrice + Math.sin(i / 5) * 2;
      const close = open + (Math.random() - 0.5) * 4;
      const high = Math.max(open, close) + Math.random();
      const low = Math.min(open, close) - Math.random();
      candles.push({ open, high, low, close });
    }
    console.log(`📊 Generated ${count} historical candles for ${symbol}`);
    return candles;
  }
}

// -----------------------------------------------------------------------------
// 🔍 Self-test mode (runs automatically when file executed directly)
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🧠 Running ExnessAdapter self-test...");
    const adapter = new ExnessAdapter({
      loginId: "demo123",
      password: "password",
      server: "Exness-Demo",
    });
    await adapter.connect();
    const isOpen = await adapter.isMarketOpen("XAUUSD");
    const price = await adapter.getPrice("XAUUSD");
    const balance = await adapter.getBalance();
    if (isOpen) {
      await adapter.placeOrder({ symbol: "XAUUSD", side: "BUY", lotSize: 0.1 });
    }
    console.log("🧾 Test summary:", { price, balance, marketOpen: isOpen });
  })();
}