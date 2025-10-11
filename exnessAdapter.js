// exnessAdapter.js
// Simple adapter interface — currently simulates or uses a stub.
// Replace internals with a real Exness/MT5 adapter (MetaApi or broker SDK) when ready.

export default class ExnessAdapter {
  constructor({ loginId, password, server, useSimulation = true }) {
    this.loginId = loginId;
    this.password = password;
    this.server = server;
    this.useSimulation = useSimulation;
    this.connected = false;
    this.balance = 10000; // simulated
    this.openTrades = [];
  }

  async connect() {
    // In real implementation: log in to broker API, establish session
    console.log("ExnessAdapter: connect()", { loginId: this.loginId, server: this.server, simulation: this.useSimulation });
    this.connected = true;
    return true;
  }

  async getPrice(symbol) {
    // Replace with broker price API
    // Simulated price: simple oscillation using time
    const base = symbol.toUpperCase().includes("XAU") ? 1900 : 1.0;
    const t = Date.now() / 10000;
    const price = +(base + Math.sin(t) * (symbol.toUpperCase().includes("XAU") ? 20 : 0.005)).toFixed(6);
    return price;
  }

  async isMarketOpen(symbol) {
    // Replace with broker-specific check if available.
    // For now: open on weekdays (Mon-Fri)
    const d = new Date();
    const day = d.getUTCDay(); // 0=Sun ... 6=Sat
    return day !== 0 && day !== 6;
  }

  async placeOrder({ symbol, side, lotSize, stopLossPrice = null, takeProfitPrice = null }) {
    // In real implementation: call broker order endpoint.
    // Simulate order ID and store in openTrades
    const id = `SIM-${Date.now()}`;
    this.openTrades.push({ id, symbol, side, lotSize, price: await this.getPrice(symbol), stopLossPrice, takeProfitPrice, ts: Date.now() });
    console.log("ExnessAdapter: placed order", id, symbol, side, lotSize);
    return { success: true, id };
  }

  async closeOrder(orderId) {
    this.openTrades = this.openTrades.filter(o => o.id !== orderId);
    return { success: true };
  }

  async getOpenTrades() {
    return this.openTrades;
  }

  async getBalance() {
    return this.balance;
  }

  // Optionally, implement fetchHistoricCandles(symbol, timeframe, count)
}