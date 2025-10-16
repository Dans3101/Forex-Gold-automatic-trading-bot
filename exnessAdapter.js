// -----------------------------------------------------------------------------
// ExnessAdapter.js
// Real-time Gold Price Adapter — Finnhub API + Smart Simulated Trading Engine
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
    this.balance = 10000; // simulated balance in USD
    this.openTrades = [];
    this.ws = null;
    this.latestPrice = null;
    this.baseUrl = "https://finnhub.io/api/v1";
    this.lastPriceTimestamp = 0;
    this.lastReconnectAttempt = 0;

    console.log("🧩 ExnessAdapter (Finnhub) initialized:", {
      simulationMode: this.useSimulation,
      apiKeyLoaded: !!this.apiKey,
    });
  }

  // ---------------------------------------------------------------------------
  // ✅ Connect to Finnhub WebSocket (auto-reconnect + subscription)
  // ---------------------------------------------------------------------------
  async connect() {
    if (!this.apiKey)
      throw new Error("❌ Missing FINNHUB_API_KEY in environment variables!");

    const wsUrl = `wss://ws.finnhub.io?token=${this.apiKey}`;
    console.log("🔌 Connecting to Finnhub WebSocket...");

    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.log("✅ Connected to Finnhub WebSocket");
      this.connected = true;
      this.ws.send(JSON.stringify({ type: "subscribe", symbol: "OANDA:XAU_USD" }));
    });

    this.ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.data && data.data[0]) {
          const tick = data.data[0];
          this.latestPrice = tick.p;
          this.lastPriceTimestamp = Date.now();
          console.log(`💹 Live price: XAU/USD = ${tick.p}`);
        }
      } catch (e) {
        console.error("⚠️ WebSocket message parse error:", e.message);
      }
    });

    this.ws.on("error", (err) => {
      console.error("⚠️ WebSocket error:", err.message);
    });

    this.ws.on("close", () => {
      console.warn("🔌 WebSocket closed. Retrying in 5s...");
      this.connected = false;
      setTimeout(() => this.reconnect(), 5000);
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // 🔁 Smart reconnect handler
  // ---------------------------------------------------------------------------
  async reconnect() {
    const now = Date.now();
    if (now - this.lastReconnectAttempt < 5000) return; // avoid rapid loops
    this.lastReconnectAttempt = now;

    try {
      await this.connect();
    } catch (err) {
      console.error("⚠️ Reconnect failed:", err.message);
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Get current price (WebSocket → REST → Simulation fallback)
  // ---------------------------------------------------------------------------
  async getPrice(symbol = "XAU/USD") {
    // Use recent WebSocket price (<15s old)
    if (this.latestPrice && Date.now() - this.lastPriceTimestamp < 15000)
      return this.latestPrice;

    const formattedSymbol = "OANDA:XAU_USD";
    const url = `${this.baseUrl}/quote?symbol=${formattedSymbol}&token=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const price = parseFloat(data.c);
      if (!isNaN(price)) {
        this.latestPrice = price;
        this.lastPriceTimestamp = Date.now();
        console.log(`💹 REST price for ${symbol}: ${price}`);
        return price;
      }
      throw new Error("Invalid price data");
    } catch (err) {
      // Fallback simulation if all fails
      const fallback = 1900 + Math.sin(Date.now() / 4000) * 8;
      console.warn(`🔁 Using simulated fallback price: ${fallback.toFixed(2)}`);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Market open/close (Mon–Fri)
  // ---------------------------------------------------------------------------
  async isMarketOpen() {
    const day = new Date().getUTCDay();
    const hour = new Date().getUTCHours();
    const open = day !== 0 && day !== 6 && hour >= 0 && hour <= 23;
    console.log(`🕒 Market status: ${open ? "OPEN ✅" : "CLOSED ❌"}`);
    return open;
  }

  // ---------------------------------------------------------------------------
  // ✅ Simulated order execution (BUY/SELL)
  // ---------------------------------------------------------------------------
  async placeOrder({ symbol = "XAU/USD", side = "BUY", lotSize = 0.1 }) {
    if (!this.connected) {
      console.warn("⚠️ Adapter not connected — using fallback simulation.");
    }

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

    const tradeCost = lotSize * price * 0.01;
    if (side === "BUY") this.balance -= tradeCost;
    if (side === "SELL") this.balance += tradeCost;

    this.openTrades.push(trade);

    console.log(`📤 Order placed: ${side} ${symbol} @ ${price.toFixed(2)} | Lot: ${lotSize}`);
    return { success: true, id, trade };
  }

  // ---------------------------------------------------------------------------
  // ✅ Close simulated trade
  // ---------------------------------------------------------------------------
  async closeOrder(orderId) {
    const trade = this.openTrades.find((t) => t.id === orderId);
    if (!trade) return { success: false, message: "Trade not found" };

    this.openTrades = this.openTrades.filter((t) => t.id !== orderId);
    console.log(`📥 Trade closed: ${orderId}`);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // ✅ Simulated account balance
  // ---------------------------------------------------------------------------
  async getBalance() {
    return this.balance;
  }

  // ---------------------------------------------------------------------------
  // ✅ Historical candle data (for strategies)
  // ---------------------------------------------------------------------------
  async fetchHistoricCandles(symbol = "OANDA:XAU_USD", resolution = "1", count = 100) {
    const url = `${this.baseUrl}/forex/candle?symbol=${symbol}&resolution=${resolution}&count=${count}&token=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.s !== "ok") throw new Error("No candle data returned");

      const candles = data.c.map((close, i) => ({
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close,
        time: data.t[i] * 1000,
      }));

      console.log(`📊 Loaded ${candles.length} candles for ${symbol}`);
      return candles;
    } catch (err) {
      console.error("⚠️ Candle fetch error:", err.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // ✅ Continuous simulation (P/L drift)
  // ---------------------------------------------------------------------------
  async simulateProfitLoss() {
    if (this.openTrades.length === 0) return;

    const drift = (Math.random() - 0.5) * 20;
    this.balance += drift;
    if (this.balance < 0) this.balance = 0;
    console.log(`📈 Simulated balance change: ${this.balance.toFixed(2)} USD`);
  }
}

// -----------------------------------------------------------------------------
// 🧠 Self-Test — run directly with `node ExnessAdapter.js`
// -----------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("🧠 Running ExnessAdapter self-test...");
    const adapter = new ExnessAdapter({ useSimulation: true });
    await adapter.connect();

    const price = await adapter.getPrice();
    const open = await adapter.isMarketOpen();
    const balance = await adapter.getBalance();
    const candles = await adapter.fetchHistoricCandles();

    if (open) await adapter.placeOrder({ side: "BUY", lotSize: 0.2 });

    console.log("✅ Self-test summary:", {
      price,
      open,
      balance,
      candles: candles.length,
    });
  })();
}