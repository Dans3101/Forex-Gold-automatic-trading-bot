// -----------------------------------------------------------------------------
// ExnessAdapter.js
// Real-time Gold Price Adapter using Finnhub API + Simulated Trading Engine
// -----------------------------------------------------------------------------

import WebSocket from "ws";
import fetch from "node-fetch";

export default class ExnessAdapter {
  constructor({
    apiKey = process.env.FINNHUB_API_KEY,
    useSimulation = true,
  } = {}) {
    this.apiKey = apiKey;
    this.useSimulation = useSimulation;
    this.connected = false;
    this.balance = 10000; // simulated USD balance
    this.openTrades = [];
    this.ws = null;
    this.latestPrice = null;
    this.baseUrl = "https://finnhub.io/api/v1";

    console.log("🧩 ExnessAdapter (Finnhub) initialized:", {
      simulationMode: useSimulation,
      apiKeyLoaded: !!this.apiKey,
    });
  }

  // ---------------------------------------------------------------------------
  // ✅ Connect to Finnhub WebSocket
  // ---------------------------------------------------------------------------
  async connect() {
    if (!this.apiKey)
      throw new Error("❌ Missing FINNHUB_API_KEY in environment variables!");

    console.log("🔌 Connecting to Finnhub WebSocket...");

    const wsUrl = `wss://ws.finnhub.io?token=${this.apiKey}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.log("✅ Connected to Finnhub WebSocket");
      this.connected = true;
      // Subscribe to live gold prices (XAU/USD)
      this.ws.send(JSON.stringify({ type: "subscribe", symbol: "OANDA:XAU_USD" }));
    });

    this.ws.on("message", (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.data && data.data[0]) {
        const price = data.data[0].p;
        this.latestPrice = price;
        console.log(`💹 Live price update: XAU/USD = ${price}`);
      }
    });

    this.ws.on("error", (err) => {
      console.error("⚠️ WebSocket error:", err.message);
    });

    this.ws.on("close", () => {
      console.warn("🔌 WebSocket disconnected. Reconnecting in 5s...");
      this.connected = false;
      setTimeout(() => this.connect(), 5000);
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fallback REST fetch (if WS price missing)
  // ---------------------------------------------------------------------------
  async getPrice(symbol = "XAU/USD") {
    if (this.latestPrice) return this.latestPrice;

    const formattedSymbol = "OANDA:XAU_USD";
    const url = `${this.baseUrl}/quote?symbol=${formattedSymbol}&token=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const price = parseFloat(data.c);
      this.latestPrice = price;
      console.log(`💹 REST price for ${symbol}: ${price}`);
      return price;
    } catch (err) {
      console.error("⚠️ Error fetching price:", err.message);
      const fallback = 1900 + Math.sin(Date.now() / 4000) * 5;
      console.log(`🔁 Using fallback simulated price: ${fallback.toFixed(2)}`);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Market status (Mon–Fri)
  // ---------------------------------------------------------------------------
  async isMarketOpen() {
    const day = new Date().getUTCDay();
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

    const tradeValue = lotSize * 100;
    if (side === "BUY") this.balance -= tradeValue * 0.01;
    if (side === "SELL") this.balance += tradeValue * 0.01;

    this.openTrades.push(trade);

    console.log(`📤 Order placed: ${side} ${symbol} @ ${price.toFixed(2)} | Lot: ${lotSize}`);
    return { success: true, id, trade };
  }

  // ---------------------------------------------------------------------------
  // ✅ Close simulated order
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
  // ✅ Get simulated balance (always keeps running)
  // ---------------------------------------------------------------------------
  async getBalance() {
    console.log(`💰 Current balance: ${this.balance.toFixed(2)} USD`);
    return this.balance;
  }

  // ---------------------------------------------------------------------------
  // ✅ Fetch historical candle data for strategy analysis
  // ---------------------------------------------------------------------------
  async fetchHistoricCandles(symbol = "OANDA:XAU_USD", resolution = "1", count = 50) {
    const url = `${this.baseUrl}/stock/candle?symbol=${symbol}&resolution=${resolution}&count=${count}&token=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.s !== "ok") throw new Error("No candle data returned");

      const candles = data.c.map((close, i) => ({
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close,
      }));

      console.log(`📊 Loaded ${candles.length} candles for ${symbol}`);
      return candles;
    } catch (err) {
      console.error("⚠️ Error fetching candles:", err.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Keep simulation running indefinitely
  // ---------------------------------------------------------------------------
  async simulateProfitLoss() {
    if (this.openTrades.length === 0) return;
    const fluctuation = (Math.random() - 0.5) * 10;
    this.balance += fluctuation;
    if (this.balance < 0) this.balance = 0;
    console.log(`📈 Simulated balance update: ${this.balance.toFixed(2)} USD`);
  }
}

// -----------------------------------------------------------------------------
// 🧠 Self-test (run directly: node ExnessAdapter.js)
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🧠 Running ExnessAdapter (Finnhub) self-test...");
    const adapter = new ExnessAdapter({ useSimulation: true });
    await adapter.connect();

    const price = await adapter.getPrice("XAU/USD");
    const open = await adapter.isMarketOpen();
    const balance = await adapter.getBalance();
    const candles = await adapter.fetchHistoricCandles();

    if (open) await adapter.placeOrder({ symbol: "XAU/USD", side: "BUY" });

    console.log("✅ Self-test complete:", {
      price,
      open,
      balance,
      candles: candles.length,
    });
  })();
}