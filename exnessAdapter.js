import MetaApi from 'metaapi.cloud-sdk'; // ✅ MetaAPI (Exness-compatible)
import { config, exness } from './config.js';

export default class ExnessAdapter {
  constructor({ loginId, password, server }) {
    this.loginId = loginId || exness.loginId;
    this.password = password || exness.password;
    this.server = server || exness.server;

    this.connection = null;
    this.account = null;
    this.connected = false;
    this.symbol = config.asset || "XAUUSD";
    this.lotSize = config.lotSize || 0.1;
  }

  /** ✅ Connect to Exness (via MetaAPI) */
  async connect() {
    try {
      console.log(`🔌 Connecting to Exness server: ${this.server} ...`);
      this.account = new MetaApi(this.loginId, this.password, this.server);
      await this.account.connect();
      this.connection = this.account.getConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();
      this.connected = true;
      console.log("✅ Connected successfully to Exness");
      return true;
    } catch (err) {
      console.error("❌ Failed to connect to Exness:", err.message);
      this.connected = false;
      return false;
    }
  }

  /** ✅ Get current price (bid/ask) */
  async getPrice(symbol = this.symbol) {
    if (!this.connected) return null;
    try {
      const quote = await this.connection.getSymbolPrice(symbol);
      return (quote.ask + quote.bid) / 2;
    } catch (err) {
      console.error(`⚠️ Failed to fetch price for ${symbol}:`, err.message);
      return null;
    }
  }

  /** ✅ Fetch balance */
  async getBalance() {
    if (!this.connected) return 0;
    try {
      const accountInfo = await this.connection.getAccountInformation();
      return accountInfo.balance;
    } catch (err) {
      console.error("⚠️ Failed to fetch balance:", err.message);
      return 0;
    }
  }

  /** ✅ Check if market is open (Mon-Fri) */
  async isMarketOpen(symbol = this.symbol) {
    const day = new Date().getUTCDay(); // 0 = Sun, 6 = Sat
    return day !== 0 && day !== 6;
  }

  /** ✅ Place trade */
  async placeOrder({ symbol = this.symbol, side, lotSize = this.lotSize, stopLossPrice, takeProfitPrice }) {
    if (!this.connected) return { success: false, error: "Not connected" };
    try {
      const result = await this.connection.createMarketOrder(symbol, side, lotSize, stopLossPrice, takeProfitPrice);
      console.log(`✅ Order placed: ${side} ${lotSize} ${symbol}`);
      return { success: true, result };
    } catch (err) {
      console.error("❌ Order failed:", err.message);
      return { success: false, error: err.message };
    }
  }

  /** ✅ Get open trades */
  async getOpenTrades() {
    if (!this.connected) return [];
    try {
      return await this.connection.getOpenPositions();
    } catch (err) {
      console.error("⚠️ Failed to get open trades:", err.message);
      return [];
    }
  }

  /** ✅ Close trade */
  async closeOrder(orderId) {
    if (!this.connected) return { success: false, error: "Not connected" };
    try {
      await this.connection.closePosition(orderId);
      console.log(`🧾 Closed order ${orderId}`);
      return { success: true };
    } catch (err) {
      console.error("❌ Failed to close order:", err.message);
      return { success: false, error: err.message };
    }
  }
}