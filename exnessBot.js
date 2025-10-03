// exnessBot.js
import MetaApi from "metaapi.cloud-sdk";
import { combinedStrategy } from "./strategies.js";

const login = process.env.EXNESS_LOGIN;
const password = process.env.EXNESS_PASSWORD;
const server = process.env.EXNESS_SERVER;
const token = process.env.METAAPI_TOKEN;

let account, connection;

export async function startExnessBot(bot) {
  try {
    const api = new MetaApi(token);

    account = await api.metatraderAccountApi.createAccount({
      name: "Exness-Demo-Bot",
      type: "cloud",
      login,
      password,
      server,
      platform: "mt5"
    });

    connection = account.getRPCConnection();
    await connection.connect();

    console.log("📡 Connected to Exness MT5 via MetaApi");

    // Telegram command: run strategy manually
    bot.onText(/^\.strategy$/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const candles = await connection.getCandles("XAUUSD", "M1", 50); // last 50 candles
        const prices = candles.map(c => c.close).reverse();
        const rsi = calculateRSI(prices, 14);

        const signal = combinedStrategy({ prices, rsi });

        if (signal === "buy") {
          await connection.createMarketBuyOrder("XAUUSD", 0.01);
          bot.sendMessage(chatId, "📈 Strategy triggered → BUY XAUUSD");
        } else if (signal === "sell") {
          await connection.createMarketSellOrder("XAUUSD", 0.01);
          bot.sendMessage(chatId, "📉 Strategy triggered → SELL XAUUSD");
        } else {
          bot.sendMessage(chatId, "⏸ Strategy says WAIT (no trade)");
        }
      } catch (err) {
        bot.sendMessage(chatId, `❌ Strategy error: ${err.message}`);
      }
    });

  } catch (err) {
    console.error("❌ Exness bot failed to start:", err.message);
  }
}

/* --- Utility Functions --- */
function calculateRSI(prices, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i - 1] - prices[i];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 1);
  return 100 - (100 / (1 + rs));
}